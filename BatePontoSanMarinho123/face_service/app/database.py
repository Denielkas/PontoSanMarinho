import psycopg2
import os


def get_db():
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "postgres-san"),
        database=os.getenv("PG_DB", "bateponto"),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASS", "123456"),
        port=int(os.getenv("PG_PORT", "5432"))
    )


def garantir_tabela_face():
    conn = get_db()
    cur = conn.cursor()

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

    conn.commit()
    cur.close()
    conn.close()