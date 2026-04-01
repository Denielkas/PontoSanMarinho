from fastapi import APIRouter
from app.models import FaceRecognize
from app.utils_face import decode_image, get_face_embedding
from app.database import get_db, garantir_tabela_face
import numpy as np
import os

router = APIRouter()


def calcular_distancia(a, b):
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    return np.linalg.norm(a - b)


@router.post("/recognize")
def recognize(data: FaceRecognize):
    conn = None
    cur = None

    try:
        garantir_tabela_face()

        img = decode_image(data.image_base64)
        emb = get_face_embedding(img)

        if emb is None:
            return {"matched": False, "error": "no_face"}

        # Baixe a tolerância para reduzir falso positivo
        tolerance = float(os.getenv("TOLERANCE", "0.45"))

        # Diferença mínima entre o melhor e o segundo melhor
        min_gap = float(os.getenv("MIN_DISTANCE_GAP", "0.03"))

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT funcionario_id, embedding
            FROM face_embeddings
            WHERE embedding IS NOT NULL
        """)
        rows = cur.fetchall()

        if not rows:
            return {"matched": False, "error": "no_registered_faces"}

        candidatos = []

        for funcionario_id, embedding in rows:
            if not embedding:
                continue

            distancia = calcular_distancia(emb, embedding)
            candidatos.append({
                "funcionario_id": funcionario_id,
                "distance": float(distancia),
            })

        if not candidatos:
            return {"matched": False, "error": "no_registered_faces"}

        candidatos.sort(key=lambda x: x["distance"])

        melhor = candidatos[0]
        segundo = candidatos[1] if len(candidatos) > 1 else None

        melhor_id = melhor["funcionario_id"]
        melhor_distancia = melhor["distance"]
        segunda_distancia = segundo["distance"] if segundo else None

        gap = None
        if segunda_distancia is not None:
            gap = segunda_distancia - melhor_distancia

        print(
            "RECOGNIZE => melhor:",
            melhor_id,
            "dist:",
            melhor_distancia,
            "segunda:",
            segunda_distancia,
            "gap:",
            gap,
            "tolerance:",
            tolerance
        )

        # Regra 1: precisa estar abaixo da tolerância
        if melhor_distancia > tolerance:
            return {
                "matched": False,
                "distance": melhor_distancia,
                "second_distance": segunda_distancia,
                "gap": gap,
                "reason": "distance_above_tolerance",
            }

        # Regra 2: precisa estar suficientemente melhor que o segundo
        if segunda_distancia is not None and gap is not None and gap < min_gap:
            return {
                "matched": False,
                "distance": melhor_distancia,
                "second_distance": segunda_distancia,
                "gap": gap,
                "reason": "ambiguous_match",
            }

        return {
            "matched": True,
            "funcionario_id": melhor_id,
            "distance": melhor_distancia,
            "second_distance": segunda_distancia,
            "gap": gap,
        }

    except Exception as e:
        print("ERRO RECOGNIZE:", repr(e))
        return {"matched": False, "error": str(e)}

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()