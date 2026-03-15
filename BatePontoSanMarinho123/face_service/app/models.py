from pydantic import BaseModel

class FaceEnroll(BaseModel):
    funcionario_id: int
    image_base64: str

class FaceRecognize(BaseModel):
    image_base64: str
