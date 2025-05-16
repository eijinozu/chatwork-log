import { useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const [apiToken, setApiToken] = useState("");
  const [roomId, setRoomId] = useState("");
  const [messageCount, setMessageCount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // APIトークンの入力処理
  const handleApiTokenChange = (e) => {
    setApiToken(e.target.value);
  };
  
  // ルームIDの入力処理
  const handleRoomIdChange = (e) => {
    setRoomId(e.target.value);
  };
  
  // メッセージ数の入力処理
  const handleMessageCountChange = (e) => {
    setMessageCount(parseInt(e.target.value) || 1);
  };
  
  // ダウンロード処理
  const handleDownload = async (e) => {
    e.preventDefault();
    
    if (!apiToken) {
      setError("APIトークンを入力してください");
      return;
    }
    
    if (!roomId) {
      setError("ルームIDを入力してください");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      // FormDataを使ってPOSTリクエスト
      const formData = new FormData();
      formData.append("api_token", apiToken);
      formData.append("room_id", roomId);
      formData.append("message_count", messageCount);
      
      // リクエストを送信
      const response = await axios.post(
        `${API}/chatwork/download`,
        formData,
        {
          responseType: "blob", // Blobとして受け取る
        }
      );
      
      // Blobを取得
      const blob = new Blob([response.data], { type: "text/csv" });
      
      // ダウンロードリンクを作成
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `chatwork_logs_${roomId}_${new Date().toISOString().replace(/:/g, "")}.csv`;
      
      // リンクをクリックしてダウンロード開始
      document.body.appendChild(a);
      a.click();
      
      // クリーンアップ
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error("ダウンロードエラー:", error);
      
      if (error.response) {
        setError(`エラー: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        setError("サーバーから応答がありませんでした");
      } else {
        setError("ダウンロード中にエラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">チャットワークログダウンローダー</h1>
          <p className="text-gray-500 mt-2">チャットワークのログをCSV形式でダウンロード</p>
        </header>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleDownload} className="space-y-6">
          <div>
            <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 mb-1">
              APIトークン
            </label>
            <input
              id="apiToken"
              type="password"
              value={apiToken}
              onChange={handleApiTokenChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="チャットワークAPIトークンを入力"
            />
          </div>
          
          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-1">
              ルームID
            </label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={handleRoomIdChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="チャットルームIDを入力"
            />
          </div>
          
          <div>
            <label htmlFor="messageCount" className="block text-sm font-medium text-gray-700 mb-1">
              ダウンロードするメッセージ数
            </label>
            <input
              id="messageCount"
              type="number"
              min="1"
              max="1000"
              value={messageCount}
              onChange={handleMessageCountChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-150 ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "ダウンロード中..." : "CSVをダウンロード"}
          </button>
        </form>
      </div>
      
      <footer className="mt-8 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} チャットワークログダウンローダー
      </footer>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
