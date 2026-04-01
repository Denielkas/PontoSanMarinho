import os
import uuid
import face_recognition
import base64
import numpy as np
from io import BytesIO
from PIL import Image


def decode_image(base64_str):
    try:
        header, encoded = base64_str.split(",", 1)
    except ValueError:
        encoded = base64_str

    img_bytes = base64.b64decode(encoded)
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def get_face_embedding(image_np):
    print("Imagem recebida shape:", image_np.shape)

    faces_locations = face_recognition.face_locations(image_np)
    print("Rostos detectados:", len(faces_locations))

    if len(faces_locations) == 0:
        return None

    faces = face_recognition.face_encodings(image_np, faces_locations)

    if len(faces) == 0:
        return None

    return faces[0]


def compare_embeddings(a, b, tolerance=None):
    if tolerance is None:
        tolerance = float(os.getenv("TOLERANCE", "0.6"))

    b = np.array(b)
    dist = np.linalg.norm(a - b)
    return dist <= tolerance


def salvar_imagem_rosto(image_np, funcionario_id):
    pasta_base = os.getenv("UPLOADS_DIR", "/app/uploads")
    pasta_rostos = os.path.join(pasta_base, "rostos")

    os.makedirs(pasta_rostos, exist_ok=True)

    nome_arquivo = f"funcionario_{funcionario_id}_{uuid.uuid4().hex}.jpg"
    caminho_absoluto = os.path.join(pasta_rostos, nome_arquivo)

    imagem = Image.fromarray(image_np)
    imagem.save(caminho_absoluto, format="JPEG", quality=90)

    return f"/uploads/rostos/{nome_arquivo}"