from fastapi import FastAPI, UploadFile, File, HTTPException
from app.schemas import QueryRequest, QueryResponse
from app.rag.retriever import RAGPipeline
import os
from typing import Optional

# optional EDGAR background ingest
try:
    from app.edgar.ingest_worker import start_worker_in_thread
except Exception:
    start_worker_in_thread = None

app = FastAPI(title="Phi-3 RAG Backend")
rag = None
@app.on_event("startup")
async def startup_event():
    # Do not load RAG at startup to save memory; load lazily
    pass
    # start EDGAR ingest worker if available
    if start_worker_in_thread:
        try:
            start_worker_in_thread()
        except Exception:
            pass

@app.post("/ingest")
async def ingest(files: list[UploadFile] = File(...)):
    # Clear old uploaded files
    import shutil
    if os.path.exists("./data/uploads"):
        shutil.rmtree("./data/uploads")
    os.makedirs("./data/uploads", exist_ok=True)
    paths = []
    for file in files:
        path = f"./data/uploads/{file.filename}"
        with open(path, "wb") as f:
            f.write(await file.read())
        paths.append(path)
    global rag
    if rag is None:
        # initialize lazily (may raise if model missing)
        try:
            rag = RAGPipeline(
                llm_model_path="./models-cache/qwen2.5-3b-q4k.gguf",
                faiss_index_path="./data/faiss_index"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize RAG: {e}")
    try:
        # Clear the vector store to use only new files
        rag.vector_store.clear()
        rag.ingest_documents(paths)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest documents: {e}")
    return {"status": "success", "ingested": len(files)}

@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    global rag
    if rag is None:
        rag = RAGPipeline(
            llm_model_path="./models-cache/qwen2.5-3b-q4k.gguf",
            faiss_index_path="./data/faiss_index"
        )
    ans = rag.query(req.question)
    return QueryResponse(answer=ans)


@app.post("/debug/context")
async def debug_context(req: QueryRequest, k: Optional[int] = 3):
    """Return the top-k context documents used for a given question."""
    global rag
    if rag is None:
        # try lazy init
        rag = RAGPipeline(
            llm_model_path="./models-cache/qwen2.5-3b-q4k.gguf",
            faiss_index_path="./data/faiss_index"
        )
    # use the vector store directly to get top-k context with scores
    results = rag.vector_store.search_with_scores(req.question, k=k)
    return {"question": req.question, "k": k, "results": results}
