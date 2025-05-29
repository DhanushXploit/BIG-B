import os
import streamlit as st
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Milvus
from langchain_community.embeddings import HuggingFaceEmbeddings  # Replacing OpenAI embeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
#from langchain_community.chat_models import ChatOllama
from langchain_community.llms import Ollama  # Replacing ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from pymilvus import connections, Collection
import uuid
import time

# Set the title of the Streamlit app
st.title("RAG Application")

# Input field for organization ID
org_id = st.text_input("Enter organization ID:")

# Initialize Milvus vector store in session state if not already present
if 'milvus_vector_store' not in st.session_state:
    st.session_state.milvus_vector_store = None

# Function to upload and process PDF files
def upload_and_process_pdf(uploaded_file, org_id):
    if not uploaded_file:
        return None

    # Save the uploaded PDF file temporarily
    temp_pdf_path = f"./temp/{uploaded_file.name}"
    with open(temp_pdf_path, "wb") as f:
        f.write(uploaded_file.read())

    # Load PDF and split into text chunks
    pdf_loader = PyPDFLoader(temp_pdf_path)
    pdf_documents = pdf_loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
    text_chunks = text_splitter.split_documents(pdf_documents)

    texts = [chunk.page_content for chunk in text_chunks]

    # Create metadata for each text chunk
    file_id = str(uuid.uuid4())
    file_name = uploaded_file.name
    source = temp_pdf_path

    metadatas = []
    for i, chunk in enumerate(text_chunks):
        metadata = {
            "unique_id": f"{org_id}{file_name}_pdf{i}",
            "org_id": org_id,
            "file_id": file_id,
            "file_name": file_name,
            "file_type": "pdf",
            "chunk_id": i,
            "char_length": len(chunk.page_content),
            "page_no": chunk.metadata.get("page", 1),
            "source": source,
            "text_content": chunk.page_content,
        }
        metadatas.append(metadata)

    return texts, metadatas

# Function to embed texts and upsert into Milvus
def embed_and_upsert(texts, metadatas):
    if not texts or not metadatas:
        return None

    index_params = {
        "metric_type": "COSINE",
        "index_type": "IVF_FLAT",
        "params": {"nlist": 1024}
    }

    # Use HuggingFace embeddings instead of OpenAI
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    connections.connect(host='localhost', port='19530')

    start_time = time.time()

    # Create Milvus vector store and upsert the embeddings
    milvus_vector_store = Milvus.from_texts(
        texts=texts,
        embedding=embeddings,
        metadatas=metadatas,
        collection_name="DEMO",
        connection_args={
            "host": "127.0.0.1",
            "port": "19530"
        },
        index_params=index_params,
        drop_old=True
    )
    
    # Flush the collection to ensure all data is written
    collection = Collection("DEMO")
    collection.flush()

    # Get the number of entities after flushing
    count = collection.num_entities
    st.write(f"Number of entities after flushing: {count}")

    end_time = time.time()
    elapsed_time = end_time - start_time

    st.write(f"Time taken for embedding and upserting: {elapsed_time:.2f} seconds")

    return milvus_vector_store

# Function to handle user queries
def handle_query(milvus_vector_store, user_query):
    if not milvus_vector_store or not user_query:
        return None

    # Convert user_query to string if it's a dictionary
    if isinstance(user_query, dict):
        user_query = user_query.get('question', '')
    elif not isinstance(user_query, str):
        user_query = str(user_query)

    # Set up the retriever for similarity search
    retriever = milvus_vector_store.as_retriever(search_params={"metric_type": "COSINE"})

    # Define the prompt template for the RAG model
    PROMPT_TEMPLATE = """
    Human: You are an AI assistant and provide answers to questions using fact-based and statistical information when possible.
    Use the following pieces of information to provide a concise answer to the question enclosed in <question> tags.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    <context>
    {context}
    </context>

    <question>
    {question}
    </question>

    The response should be specific and use statistics or numbers when possible.

    Assistant:"""

    prompt_template = PromptTemplate(
        template=PROMPT_TEMPLATE, input_variables=["context", "question"]
    )

    def format_text_chunks(chunks):
        return "\n\n".join(chunk.page_content for chunk in chunks)

    # Replacing OpenAI model with LLaMA 3.2 Vision model via Ollama
    rag_model = Ollama(model="llama3.2:latest", temperature=0)

    rag_chain = (
        {"context": retriever | format_text_chunks, "question": RunnablePassthrough()}
        | prompt_template
        | rag_model
        | StrOutputParser()
    )

    start_time = time.time()

    # Perform similarity search and generate response
    top_k_chunks = milvus_vector_store.similarity_search_with_score(user_query, k=3, search_params={"metric_type": "COSINE"})
    response = rag_chain.invoke(user_query)

    end_time = time.time()
    elapsed_time = end_time - start_time

    st.write(f"Time taken for query retrieval: {elapsed_time:.2f} seconds")

    st.write("Response:")
    st.write(response)

# Main application logic
if org_id:
    # Create temp directory if not exists
    if not os.path.exists("./temp"):
        os.makedirs("./temp")

    # Upload PDF files
    uploaded_files = st.file_uploader("Upload PDF files", type=["pdf"], accept_multiple_files=True)

    if uploaded_files and st.session_state.milvus_vector_store is None:
        all_texts = []
        all_metadatas = []
        for uploaded_file in uploaded_files:
            texts, metadatas = upload_and_process_pdf(uploaded_file, org_id)
            if texts and metadatas:
                all_texts.extend(texts)
                all_metadatas.extend(metadatas)

        if all_texts and all_metadatas:
            # Embed and upsert the texts into Milvus
            st.session_state.milvus_vector_store = embed_and_upsert(all_texts, all_metadatas)
            if st.session_state.milvus_vector_store:
                st.write("Embeddings have been added to Milvus.")

    # Input field for user query
    user_query = st.text_input("Enter your query:")

    if user_query and st.session_state.milvus_vector_store:
        # Handle the user query
        handle_query(st.session_state.milvus_vector_store, user_query)
