import { useState, useEffect } from "react";
import Vapi from "@vapi-ai/web";
import { Mic, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Initialize Vapi with the Public Key from environment variables
// Make sure to add VITE_VAPI_PUBLIC_KEY to your .env file
const vapi = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY || "dummy-key");

export function VoiceWidget() {
  const [status, setStatus] = useState<"inactive" | "loading" | "active">("inactive");
  const [transcript, setTranscript] = useState<Array<{ role: string, text: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen to Vapi events
    vapi.on("call-start", () => {
      setStatus("active");
    });

    vapi.on("call-end", () => {
      setStatus("inactive");
    });

    vapi.on("message", (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setTranscript(prev => [...prev, { role: message.role, text: message.transcript }]);
      }
    });

    vapi.on("error", (error) => {
      console.error("Vapi error:", error);
      setStatus("inactive");
    });

    return () => {
      vapi.removeAllListeners();
    };
  }, []);

  const toggleCall = () => {
    if (status === "inactive") {
      setStatus("loading");
      setIsOpen(true);
      setTranscript([]);
      // Make sure to add VITE_VAPI_ASSISTANT_ID to your .env file
      const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
      if (!assistantId) {
        alert("Please set VITE_VAPI_ASSISTANT_ID in your environment variables");
        setStatus("inactive");
        return;
      }
      vapi.start(assistantId);
    } else {
      vapi.stop();
      setStatus("inactive");
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-24">
      {isOpen && (
        <div className="mb-4 w-72 md:w-80 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transform transition-all">
          <div className="bg-primary p-4 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">Voice Assistant</h3>
              <p className="text-xs opacity-90 text-white/80">
                {status === "loading" ? "Connecting..." : status === "active" ? "Listening..." : "Call Ended"}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
          
          <div className="h-64 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {transcript.length === 0 && status !== "inactive" && (
              <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                Say something to start...
              </div>
            )}
            {transcript.map((msg, idx) => (
              <div key={idx} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user" 
                  ? "bg-primary text-white self-end rounded-tr-sm" 
                  : "bg-white border border-gray-100 text-gray-800 self-start rounded-tl-sm shadow-sm"
              }`}>
                <span className="font-bold text-[10px] uppercase opacity-70 block mb-1">
                  {msg.role === "user" ? "You" : "Pressy"}
                </span>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={toggleCall}
        size="icon"
        className={`h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ${
          status === "active" ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-primary hover:bg-primary/90"
        }`}
      >
        {status === "loading" ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : status === "active" ? (
          <PhoneOff className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </Button>
    </div>
  );
}
