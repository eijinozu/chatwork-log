from fastapi import FastAPI, APIRouter, HTTPException, Form, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import requests
import pandas as pd
import io


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ChatworkRequest(BaseModel):
    api_token: str
    room_id: str
    message_count: int = 100

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/chatwork/download")
async def download_chatwork_logs(
    api_token: str = Form(...),
    room_id: str = Form(...),
    message_count: int = Form(100)
):
    try:
        # チャットワークAPIのエンドポイント
        api_url = f"https://api.chatwork.com/v2/rooms/{room_id}/messages"
        
        # APIリクエストヘッダー
        headers = {
            "X-ChatWorkToken": api_token
        }
        
        # APIリクエスト
        response = requests.get(api_url, headers=headers, params={"force": 1})
        
        # エラー処理
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Chatwork API Error: {response.text}"
            )
        
        # レスポンスをJSONに変換
        messages = response.json()
        
        # 指定されたメッセージ数に制限
        messages = messages[:message_count]
        
        # CSVに変換するためのデータ準備
        csv_data = []
        for msg in messages:
            csv_data.append({
                "message_id": msg.get("message_id"),
                "account_id": msg.get("account").get("account_id") if "account" in msg else "",
                "name": msg.get("account").get("name") if "account" in msg else "",
                "body": msg.get("body"),
                "send_time": datetime.fromtimestamp(msg.get("send_time")).strftime('%Y-%m-%d %H:%M:%S') if "send_time" in msg else "",
                "update_time": datetime.fromtimestamp(msg.get("update_time")).strftime('%Y-%m-%d %H:%M:%S') if "update_time" in msg else ""
            })
        
        # DataFrameに変換
        df = pd.DataFrame(csv_data)
        
        # CSVファイルを生成
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False, encoding='utf-8')
        
        # レスポンスにCSVファイルを設定
        response = Response(content=csv_buffer.getvalue(), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=chatwork_logs_{room_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        
        return response
        
    except Exception as e:
        # エラーをログに記録
        logging.error(f"Error downloading Chatwork logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
