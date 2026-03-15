from fastapi import APIRouter
from app.models import FaceRecognize
from app.utils_face import decode_image, get_face_embedding, compare_embeddings
from app.database import get_db

router = APIRouter()

@router.post("/recognize")
def recognize(data: FaceRecognize):
    try:
        img = decode_image(data.image_base64)
        emb = get_face_embedding(img)

        if emb is None:
            return {"matched": False, "error": "no_face"}

        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT funcionario_id, embedding FROM face_embeddings")
        rows = cur.fetchall()

        cur.close()
        conn.close()

        for funcionario_id, embedding in rows:
            if compare_embeddings(emb, embedding):
                return {
                    "matched": True,
                    "funcionario_id": funcionario_id
                }

        return {"matched": False}

    except Exception as e:
        print("ERRO RECOGNIZE:", e)
        return {"matched": False, "error": str(e)}
