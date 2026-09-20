# app/main.py
# Builds the FastAPI application

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.config import settings

app = FastAPI(title='ResViz API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_urls,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix='/api')

@app.get('/')
async def root():
    return {
        'message': 'ResViz API is running',
        'docs': '/docs',
    }

