from fastapi import APIRouter
from app.models import FaceEnroll
from app.database import get_db
from app.utils_face import decode_image, get_face_embedding
import psycopg2

router = APIRouter()

@router.post("/enroll")
def enroll(data: FaceEnroll):
    try:
        img = decode_image(data.image_base64)
        emb = get_face_embedding(img)

        if emb is None:
            return {"ok": False, "error": "no_face"}

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO face_embeddings (funcionario_id, embedding)
            VALUES (%s, %s)
            ON CONFLICT (funcionario_id)
            DO UPDATE SET embedding = EXCLUDED.embedding;
        """, (data.funcionario_id, emb.tolist()))

        conn.commit()
        cur.close()
        conn.close()

        return {"ok": True}

    except Exception as e:
        print("ERRO ENROLL:", e)
        return {"ok": False, "error": str(e)}
