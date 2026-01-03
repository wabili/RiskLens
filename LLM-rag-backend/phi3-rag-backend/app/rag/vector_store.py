import os
import faiss
import numpy as np

class FAISSStore:
    def __init__(self, embedding_model, index_path):
        self.embedding_model = embedding_model
        self.index_path = index_path
        self.index = None
        self.docs = []
        self._load_or_create_index()

    def _load_or_create_index(self):
        dim = 384
        if os.path.exists(f"{self.index_path}.faiss"):
            self.index = faiss.read_index(f"{self.index_path}.faiss")
            with open(f"{self.index_path}.docs", "r") as f:
                self.docs = f.read().split("\n--DOC--\n")[:-1]
        else:
            self.index = faiss.IndexFlatL2(dim)

    def add_documents(self, docs):
        embeddings = self.embedding_model.encode(docs, normalize_embeddings=True)
        if self.index is None:
            dim = embeddings.shape[1]
            self.index = faiss.IndexFlatL2(dim)
        self.index.add(np.array(embeddings).astype('float32'))
        self.docs.extend(docs)
        self._save_index()

    def search(self, query, k=3):
        # If no documents have been ingested yet, return empty context
        if not self.docs or self.index is None or getattr(self.index, 'ntotal', 0) == 0:
            return ""
        query_vec = self.embedding_model.encode([query], normalize_embeddings=True)
        k_search = min(k, len(self.docs))
        D, I = self.index.search(np.array(query_vec).astype('float32'), k_search)
        results = [self.docs[i] for i in I[0] if i < len(self.docs)]
        return "\n\n".join(results)

    def search_with_scores(self, query, k=3):
        """Return list of top-k results with indices and distances/scores.

        Returns: [ {"id": int, "score": float, "text": str}, ... ]
        """
        if not self.docs or self.index is None or getattr(self.index, 'ntotal', 0) == 0:
            return []
        query_vec = self.embedding_model.encode([query], normalize_embeddings=True)
        k_search = min(k, len(self.docs))
        D, I = self.index.search(np.array(query_vec).astype('float32'), k_search)
        out = []
        for j in range(k_search):
            idx = int(I[0][j])
            if idx < len(self.docs):
                out.append({
                    "id": idx,
                    "score": float(D[0][j]),
                    "text": self.docs[idx]
                })
        return out

    def clear(self):
        dim = 384  # bge-small-en-v1.5 dimension
        self.index = faiss.IndexFlatL2(dim)
        self.docs = []
        self._save_index()

    def _save_index(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(self.index, f"{self.index_path}.faiss")
        with open(f"{self.index_path}.docs", "w") as f:
            f.write("\n--DOC--\n".join(self.docs))
