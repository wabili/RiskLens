import fitz

def load_documents(file_paths):
    docs = []
    for path in file_paths:
        if path.endswith('.pdf'):
            doc = fitz.open(path)
            text = "".join(page.get_text() for page in doc)
            docs.append(text)
        elif path.endswith('.txt'):
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                docs.append(f.read())
    return docs
