from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
import logging
import json
import ollama
import numpy as np
from sentence_transformers import SentenceTransformer

from schemas import (
    ExtractSkillsRequest, 
    GenerateEmbeddingRequest, 
    GenerateEmbeddingResponse,
    MatchJobsRequest,
    MatchJobsResponseItem
)
# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model variable
embedding_model: SentenceTransformer | None = None

OLLAMA_MODEL = "llama3.2"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedding_model
    logger.info("SentenceTransformer (all-MiniLM-L6-v2) modeli yükleniyor...")
    try:
        # Load model into RAM
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model başarıyla RAM'e yüklendi.")
    except Exception as e:
        logger.error(f"Model yüklenirken hata oluştu: {e}")
    
    yield
    
    # Clean up resources when the application shuts down
    logger.info("Uygulama kapanıyor, kaynaklar temizleniyor...")
    embedding_model = None

# Create FastAPI application
app = FastAPI(
    title="HR Platform AI Service",
    description="İnsan Kaynakları platformu için metin analizi ve vektör üretimi yapan Python mikroservisi.",
    version="1.0.0",
    lifespan=lifespan
)

@app.post("/extract-skills", response_model=list[str], summary="Metinden Yetenek Çıkarımı")
async def extract_skills(request: ExtractSkillsRequest):
    """
    Gelen metni yerel Ollama modeli ile analiz eder ve teknik/soft yetenekleri çıkarır.
    """
    # Determine appropriate prompt for candidate or company
    if request.type == 'company':
        system_prompt = (
            "Sen bir İK uzmanısın. Aşağıdaki İŞ İLANINDAN şirketin aradığı zorunlu teknik yetenekleri çıkar. "
            "Yol, yemek, sigorta, ofis içi gibi sosyal hakları veya çalışma şartlarını kesinlikle yetenek olarak alma. "
            "DİKKAT: Çıktın sadece bir JSON objesi (object) olmalıdır. Hiçbir ek açıklama, markdown veya formatlama yapma. "
            "Sadece şu formatta yanıt ver: {\"skills\": [\"Yetenek1\", \"Yetenek2\", \"Yetenek3\"]}"
        )
    else:
        # Default: Candidate Resume
        system_prompt = (
            "Sen bir İK uzmanısın. Aşağıdaki ADAY ÖZGEÇMİŞİNDEN adayın sahip olduğu teknik ve soft yetenekleri çıkar. "
            "DİKKAT: Çıktın sadece bir JSON objesi (object) olmalıdır. Hiçbir ek açıklama, markdown veya formatlama yapma. "
            "Sadece şu formatta yanıt ver: {\"skills\": [\"Yetenek1\", \"Yetenek2\", \"Yetenek3\"]}"
        )

    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ],
            format="json"
        )
        
        # Getting text from Ollama
        content = response.get('message', {}).get('content', '').strip()
        
        # Clean up possible Markdown (```json ... ```) blocks
        if content.startswith("```"):
            lines = content.splitlines()
            if len(lines) > 2:
                content = "\n".join(lines[1:-1])
            elif content.startswith("```json"):
                content = content[7:]
                if content.endswith("```"):
                    content = content[:-3]
        
        # Parse JSON structure
        parsed_json = json.loads(content)
        
        skills = None
        # Parsing
        if isinstance(parsed_json, dict):
            skills = parsed_json.get("skills")
            # If 'skills' key is missing, find any list value inside
            if not isinstance(skills, list):
                for key, value in parsed_json.items():
                    if isinstance(value, list):
                        skills = value
                        break
        elif isinstance(parsed_json, list):
            skills = parsed_json
            
        if not isinstance(skills, list):
            raise ValueError(f"LLM sonucu geçerli bir yetenek listesi (array) içermiyor. Ham çıktı: {content}")
            
        return skills

    except json.JSONDecodeError as e:
        logger.error(f"LLM çıktısı JSON olarak parse edilemedi. Çıktı: {content}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI modelinden gelen yanıt geçerli bir JSON formatında değildi."
        )
    except Exception as e:
        logger.error(f"Ollama servisi hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama AI servisi şu anda kullanılamıyor veya isteği işleyemedi."
        )

@app.post("/generate-embedding", response_model=GenerateEmbeddingResponse, summary="Metinden Vektör (Embedding) Üretimi")
async def generate_embedding(request: GenerateEmbeddingRequest):
    """
    Hafızaya yüklenmiş SentenceTransformers modelini kullanarak metni 384 boyutlu vektöre çevirir.
    """
    if embedding_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding modeli henüz yüklenmedi veya başlatılamadı."
        )
        
    try:
        # Convert text to 384-dimensional vector
        embedding = embedding_model.encode(request.text).tolist()
        
        return GenerateEmbeddingResponse(embedding=embedding)
    except Exception as e:
        logger.error(f"Embedding üretilirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vektör (embedding) üretimi sırasında bir hata oluştu."
        )

@app.post("/match-jobs", response_model=list[MatchJobsResponseItem], summary="Aday ve İş İlanları Arasında Vektörel Eşleştirme")
async def match_jobs(request: MatchJobsRequest):
    """
    Aday vektörü ile ilan vektörlerini Kosinüs Benzerliği kullanarak eşleştirir.
    """
    
    if not request.job_postings:
        return []
        
    candidate_vec = request.candidate_vector

        
    try:
       
        A = np.array(candidate_vec, dtype=np.float32)
        
        job_ids = [job.id for job in request.job_postings]
        
        B = np.array([job.vector for job in request.job_postings], dtype=np.float32)
        
        dot_products = np.dot(B, A)
        
        norm_a = np.linalg.norm(A)
       
        norm_b = np.linalg.norm(B, axis=1)
        
        denominator = np.clip(norm_a * norm_b, a_min=1e-8, a_max=None)
        
        similarities = dot_products / denominator
        
        results = []
        for i, job_id in enumerate(job_ids):
            score = float(similarities[i])
            results.append(MatchJobsResponseItem(id=job_id, score=score))
            
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results
        
    except Exception as e:
        logger.error(f"Eşleştirme (Matching) hesaplanırken hata oluştu: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Matematiksel eşleştirme motorunda kritik bir hata oluştu."
        )
