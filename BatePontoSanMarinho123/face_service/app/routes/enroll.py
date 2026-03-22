from fastapi import APIRouter
from app.models import FaceEnroll
from app.database import get_db
from app.utils_face import decode_image, get_face_embedding

router = APIRouter()

def garantir_tabela_face_embeddings(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS face_embeddings (
            funcionario_id BIGINT PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
            embedding FLOAT8[] NOT NULL
        );
    """)

@router.post("/enroll")
def enroll(data: FaceEnroll):
    conn = None
    cur = None

    try:
        print("Iniciando enroll do funcionario:", data.funcionario_id)

        img = decode_image(data.image_base64)
        emb = get_face_embedding(img)

        if emb is None:
            return {"ok": False, "error": "Nenhum rosto encontrado na imagem."}

        conn = get_db()
        cur = conn.cursor()

        garantir_tabela_face_embeddings(cur)

        cur.execute("""
            INSERT INTO face_embeddings (funcionario_id, embedding)
            VALUES (%s, %s)
            ON CONFLICT (funcionario_id)
            DO UPDATE SET embedding = EXCLUDED.embedding;
        """, (data.funcionario_id, emb.tolist()))

        conn.commit()
        return {"ok": True, "message": "Rosto cadastrado com sucesso."}

    except Exception as e:
        if conn:
            conn.rollback()
        print("ERRO ENROLL:", repr(e))
        return {"ok": False, "error": str(e)}

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()