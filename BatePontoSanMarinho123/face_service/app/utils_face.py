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
    faces = face_recognition.face_encodings(image_np)

    if len(faces) == 0:
        return None
    
    return faces[0]

def compare_embeddings(a, b, tolerance=0.45):
    dist = np.linalg.norm(a - b)
    return dist <= tolerance
