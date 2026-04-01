from fastapi import APIRouter
from app.models import FaceEnroll
from app.database import get_db
from app.utils_face import decode_image, get_face_embedding, salvar_imagem_rosto

router = APIRouter()


def garantir_tabela_face_embeddings(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS face_embeddings (
            funcionario_id BIGINT PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
            embedding FLOAT8[],
            foto_path TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    try:
        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS foto_path TEXT;
        """)
    except Exception:
        pass

    try:
        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        """)
    except Exception:
        pass

    try:
        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
        """)
    except Exception:
        pass

    try:
        cur.execute("""
            ALTER TABLE face_embeddings
            ALTER COLUMN embedding DROP NOT NULL;
        """)
    except Exception:
        pass


@router.post("/enroll")
def enroll(data: FaceEnroll):
    conn = None
    cur = None

    try:
        img = decode_image(data.image_base64)
        emb = get_face_embedding(img)

        if emb is None:
            return {"ok": False, "error": "Nenhum rosto encontrado na imagem."}

        foto_path = salvar_imagem_rosto(img, data.funcionario_id)

        conn = get_db()
        cur = conn.cursor()

        garantir_tabela_face_embeddings(cur)

        cur.execute("""
            INSERT INTO face_embeddings (
                funcionario_id,
                embedding,
                foto_path,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT (funcionario_id)
            DO UPDATE SET
                embedding = EXCLUDED.embedding,
                foto_path = EXCLUDED.foto_path,
                updated_at = NOW();
        """, (data.funcionario_id, emb.tolist(), foto_path))

        conn.commit()

        return {
            "ok": True,
            "message": "Rosto cadastrado com sucesso.",
            "foto_path": foto_path
        }

    except Exception as e:
        if conn:
            conn.rollback()
        return {"ok": False, "error": str(e)}

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()