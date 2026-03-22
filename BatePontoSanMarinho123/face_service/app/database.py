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
            embedding FLOAT8[] NOT NULL
        );
    """)

    conn.commit()
    cur.close()
    conn.close()