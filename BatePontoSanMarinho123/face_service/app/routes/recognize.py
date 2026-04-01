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

        tolerance = float(os.getenv("TOLERANCE", "0.6"))

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

        melhor_funcionario_id = None
        menor_distancia = None

        for funcionario_id, embedding in rows:
            if not embedding:
                continue

            distancia = calcular_distancia(emb, embedding)

            if menor_distancia is None or distancia < menor_distancia:
                menor_distancia = distancia
                melhor_funcionario_id = funcionario_id

        if melhor_funcionario_id is not None and menor_distancia is not None:
            if menor_distancia <= tolerance:
                return {
                    "matched": True,
                    "funcionario_id": melhor_funcionario_id,
                    "distance": float(menor_distancia),
                }

        return {
            "matched": False,
            "distance": float(menor_distancia) if menor_distancia is not None else None,
        }

    except Exception as e:
        print("ERRO RECOGNIZE:", repr(e))
        return {"matched": False, "error": str(e)}

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()