from fastapi import APIRouter
from app.models import FaceRecognize
from app.utils_face import decode_image, get_face_embedding, compare_embeddings
from app.database import get_db, garantir_tabela_face

router = APIRouter()


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

        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT funcionario_id, embedding FROM face_embeddings")
        rows = cur.fetchall()

        for funcionario_id, embedding in rows:
            if compare_embeddings(emb, embedding):
                return {
                    "matched": True,
                    "funcionario_id": funcionario_id,
                }

        return {"matched": False}

    except Exception as e:
        print("ERRO RECOGNIZE:", repr(e))
        return {"matched": False, "error": str(e)}

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()