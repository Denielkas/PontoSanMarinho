import os
import uuid
from PIL import Image

def salvar_imagem_rosto(image_np, funcionario_id):
    pasta_base = os.getenv("UPLOADS_DIR", "/app/uploads")
    pasta_rostos = os.path.join(pasta_base, "rostos")
    os.makedirs(pasta_rostos, exist_ok=True)

    nome_arquivo = f"funcionario_{funcionario_id}_{uuid.uuid4().hex}.jpg"
    caminho_absoluto = os.path.join(pasta_rostos, nome_arquivo)

    imagem = Image.fromarray(image_np)
    imagem.save(caminho_absoluto, format="JPEG", quality=90)

    return f"/uploads/rostos/{nome_arquivo}"