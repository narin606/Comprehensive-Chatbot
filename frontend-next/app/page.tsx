"use client";

import clsx from "clsx";
import Image from "next/image";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SourceItem = {
  title: string;
  section: number;
};

type MediaItem = {
  id: string;
  title: string;
  description: string;
  media_type: string;
  source: string;
  thumbnail?: string | null;
  tags?: string[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
};

type BackendState = "idle" | "checking" | "online" | "offline";

type NavView = "home" | "chatbot" | "content";

export default function HomePage() {
  const defaultBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";
  const [backendUrl] = useState(defaultBackendUrl);
  const [, setBackendState] = useState<BackendState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionNote, setTranscriptionNote] = useState<string | null>(null);
  const [shouldTranslate, setShouldTranslate] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [activeView, setActiveView] = useState<NavView>("home");
  const [homeSlideIndex, setHomeSlideIndex] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const normalizedBackendUrl = useMemo(
    () => backendUrl.replace(/\/+$/, ""),
    [backendUrl]
  );

  const assetBase = useMemo(() => `${normalizedBackendUrl}/slideshow-assets`, [normalizedBackendUrl]);

  const homeSlides = useMemo(
    () => [
      {
        id: "overview",
        title: "Integrated Security & Automation",
        description:
          "Explore Oneberry's end-to-end surveillance, robotics, and AI solutions that secure facilities efficiently.",
        image: `${assetBase}/1.oneberry.png`,
        background: "linear-gradient(135deg, rgba(31, 41, 51, 0.9), rgba(15, 23, 42, 0.95))",
      },
      {
        id: "products",
        title: "Smart Security Portfolio",
        description:
          "A holistic mix of kiosks, surveillance trailers, and command centre software built to scale rapidly.",
        image: `${assetBase}/2.product.png`,
        background: "linear-gradient(135deg, rgba(22, 163, 74, 0.85), rgba(21, 128, 61, 0.95))",
      },
      {
        id: "arvas",
        title: "ARVAS Anomaly Detection",
        description:
          "AI-driven video analytics surfaces unusual behaviour instantly so teams can focus on rapid response.",
        image: `${assetBase}/3.ARVAS.png`,
        background: "linear-gradient(135deg, rgba(255, 111, 60, 0.9), rgba(249, 115, 22, 0.9))",
      },
      {
        id: "kenobi",
        title: "KenOBI Autonomous Patrols",
        description:
          "Autonomous robots deliver 24/7 coverage with seamless wireless docking and coordinated command centre alerts.",
        image: `${assetBase}/4.kenobi.png`,
        background: "linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(30, 64, 175, 0.9))",
      },
      {
        id: "invisiron",
        title: "Invisiron Cyber Defence",
        description:
          "Network-level protection that keeps Oneberry deployments secure from emerging cyber threats.",
        image: `${assetBase}/5.invisiron.png`,
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(79, 70, 229, 0.9))",
      },
    ],
    [assetBase]
  );

  const historyPayload = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages]
  );
  const activeHomeSlide = homeSlides[homeSlideIndex] ?? homeSlides[0];
  const currentMediaIndex = useMemo(
    () => (selectedMedia ? mediaItems.findIndex((item) => item.id === selectedMedia.id) : -1),
    [mediaItems, selectedMedia]
  );

  const pingBackend = useCallback(async () => {
    setBackendState("checking");
    try {
      const response = await fetch(`${normalizedBackendUrl}/health`, {
        method: "GET"
      });
      if (!response.ok) {
        throw new Error("Unhealthy");
      }
      setBackendState("online");
    } catch (err) {
      console.error("Health check failed", err);
      setBackendState("offline");
    }
  }, [normalizedBackendUrl]);

  useEffect(() => {
    pingBackend();
  }, [pingBackend]);

  useEffect(() => {
    if (homeSlides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setHomeSlideIndex((prev) => (prev + 1) % homeSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [homeSlides.length]);

  useEffect(() => {
    if (activeView === "home") {
      setHomeSlideIndex(0);
    }
  }, [activeView]);

  useEffect(() => {
    let cancelled = false;

    async function loadMedia() {
      setMediaLoading(true);
      setMediaError(null);
      try {
        const response = await fetch(`${normalizedBackendUrl}/media`);
        if (!response.ok) {
          throw new Error(`Media request failed with ${response.status}`);
        }
        const payload = await response.json();
        const items: MediaItem[] = payload.items ?? [];
        if (!cancelled) {
          setMediaItems(items);
          setSelectedMedia(items.length > 0 ? items[0] : null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load media catalogue.";
          setMediaItems([]);
          setSelectedMedia(null);
          setMediaError(message);
        }
      } finally {
        if (!cancelled) {
          setMediaLoading(false);
        }
      }
    }

    loadMedia();

    return () => {
      cancelled = true;
    };
  }, [normalizedBackendUrl]);

  const handleSend = async (event?: FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    const trimmed = messageInput.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setMessageInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${normalizedBackendUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: historyPayload })
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail ?? `Request failed with ${response.status}`);
      }

      const data: { answer: string; sources: SourceItem[] } = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources ?? [] }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while chatting.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to contact backend: ${message}` }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setMessageInput("");
    setError(null);
    setTranscriptionNote(null);
  };

  const stopAllTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const requestRecording = async () => {
    if (recording || transcribing) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopAllTracks();
        setRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size === 0) {
          setTranscriptionNote("No audio captured.");
          return;
        }
        await transcribeBlob(blob);
      };

      chunksRef.current = chunks;
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setRecording(true);
      setTranscriptionNote("Recording... press stop when finished.");
    } catch (err) {
      console.error("Failed to start recorder", err);
      setError(
        err instanceof Error ? err.message : "Could not access the microphone. Check browser permissions."
      );
      stopAllTracks();
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
    }
  };

  const transcribeBlob = async (blob: Blob) => {
    setTranscribing(true);
    setTranscriptionNote("Transcribing audio...");
    setError(null);

    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("translate", shouldTranslate ? "true" : "false");
    if (selectedLanguage !== "auto") {
      form.append("language", selectedLanguage);
    }

    try {
      const response = await fetch(`${normalizedBackendUrl}/transcribe`, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail ?? `Transcription failed: ${response.status}`);
      }

      const data: { text: string; translated: boolean; detected_language?: string | null } =
        await response.json();

      setMessageInput((prev) => (prev ? `${prev}\n${data.text.trim()}` : data.text.trim()));
      setTranscriptionNote(
        `Ready: ${data.translated ? "Translated" : "Transcribed"} ${
          data.detected_language ? `(detected ${data.detected_language})` : ""
        }`
      );
    } catch (err) {
      console.error("Transcription error", err);
      setError(err instanceof Error ? err.message : "Failed to transcribe the recording.");
      setTranscriptionNote("Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      requestRecording();
    }
  };

  const renderHomePanel = () => (
    <section className="panel">
      <h2>Welcome</h2>
      <p>
        Use the navigation to explore the command centre. Choose <strong>Content View</strong> to pick
        a video and <strong>ChatBot</strong> to ask Oneberry-specific questions.
      </p>
      <button type="button" className="primary" onClick={() => setActiveView("chatbot")}>
        Jump to ChatBot
      </button>
    </section>
  );


  const renderChatPanel = () => (
    <section className="panel chat-panel full">
      <div className="conversation" aria-live="polite">
        {messages.length === 0 && (
          <div className="bubble assistant">
            Ask about Oneberry solutions, partners, or kiosk capabilities to get started.
          </div>
        )}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={clsx("bubble", message.role)}>
            <ReactMarkdown className="markdown" remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.role === "assistant" && message.sources && message.sources.length > 0 && (
              <details className="sources">
                <summary className="sources-toggle">Reference snippets</summary>
                <div className="source-list">
                  {message.sources.map((source) => (
                    <span
                      key={`${source.title}-${source.section}`}
                      className="source-pill"
                    >
                      <span className="source-title-text">{source.title}</span>
                      <span className="source-section">Section {source.section}</span>
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="compose" onSubmit={handleSend}>
        <textarea
          value={messageInput}
          placeholder="Type or dictate your question about Oneberry."
          onChange={(event) => setMessageInput(event.target.value)}
        />

        <div className="composer-actions">
          <div className="language-row">
            <label className="language-label" htmlFor="languageSelect">
              Language hint:
            </label>
            <select
              id="languageSelect"
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              disabled={recording || transcribing}
              className="language-select"
            >
              {["auto", "en", "zh", "ms", "ta", "ja", "fr", "es"].map((value) => (
                <option key={value} value={value}>
                  {value === "auto" ? "Auto detect" : value.toUpperCase()}
                </option>
              ))}
            </select>

            <label className="translate-checkbox">
              <input
                type="checkbox"
                checked={shouldTranslate}
                onChange={(event) => setShouldTranslate(event.target.checked)}
                disabled={recording || transcribing}
              />
              Translate to English
            </label>
          </div>

          {transcriptionNote && (
            <span className="transcription-status">{transcriptionNote}</span>
          )}

          <div className="button-row">
            <button
              type="button"
              className={clsx("icon-button", { active: recording })}
              onClick={toggleRecording}
              disabled={transcribing}
              aria-pressed={recording}
              aria-label={recording ? "Stop voice capture" : "Start voice capture"}
            >
              <span className="sr-only">
                {recording ? "Stop voice capture" : "Start voice capture"}
              </span>
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12z" />
              </svg>
            </button>
            <button type="submit" className="primary send-button" disabled={isSending}>
              {isSending ? "Sending..." : "Send"}
            </button>
            <button type="button" className="neutral" onClick={handleClear} disabled={isSending}>
              Clear
            </button>
          </div>
        </div>
      </form>
    </section>
  );


  const renderHomeSlideshow = () => {
    const slide = activeHomeSlide;
    if (!slide) {
      return (
        <div className="preview-placeholder full">
          <p>No highlights available.</p>
        </div>
      );
    }

    return (
      <div className="preview-placeholder full home-slideshow-container">
        <div
          className={clsx("home-slide", { "home-slide--with-image": Boolean(slide.image) })}
          style={!slide.image ? { background: slide.background } : undefined}
        >
          {slide.image && (
            <Image src={slide.image} alt={slide.title} fill sizes="100vw" className="home-slide-image" priority />
          )}
          <div className="home-slide-overlay" />
          <div className="home-slide-content">
            <span className="home-slide-kicker">Oneberry Highlights</span>
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>
          </div>
        </div>

        <div className="home-slide-dots" role="tablist" aria-label="Highlights">
          {homeSlides.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={clsx("home-slide-dot", { active: index === homeSlideIndex })}
              onClick={() => setHomeSlideIndex(index)}
              aria-label={`Show highlight: ${item.title}`}
              aria-pressed={index === homeSlideIndex}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderContentPanel = () => (
    <section className="panel content-panel">
      <h2>Content Library</h2>
      {mediaError ? (
        <p className="media-error">{mediaError}</p>
      ) : (
        <>
          {mediaLoading && <p className="media-status">Loading media...</p>}
          <div className="media-list">
            {mediaItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx("media-option", { active: selectedMedia?.id === item.id })}
                onClick={() => setSelectedMedia(item)}
              >
                <span className="media-option-title">{item.title}</span>
                {item.tags && item.tags.length > 0 && (
                  <span className="media-option-tags">{item.tags.join(", ")}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const renderNavContent = () => {
    switch (activeView) {
      case "home":
        return renderHomePanel();
      case "chatbot":
        return null;
      case "content":
        return renderContentPanel();
      default:
        return renderHomePanel();
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <header className="brand">
          <Image
            src="/oneberry-logo.webp"
            alt="Oneberry"
            width={200}
            height={60}
            className="brand-logo"
            priority
          />
        </header>

        <nav className="nav-list" aria-label="Primary">
          <button
            type="button"
            className={clsx("nav-item", { active: activeView === "home" })}
            onClick={() => setActiveView("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={clsx("nav-item", { active: activeView === "chatbot" })}
            onClick={() => setActiveView("chatbot")}
          >
            ChatBot
          </button>
          <button
            type="button"
            className={clsx("nav-item", { active: activeView === "content" })}
            onClick={() => setActiveView("content")}
          >
            Content View
          </button>
        </nav>

        <div className="sidebar-content">{renderNavContent()}</div>
      </aside>

      <main className="preview-area">
        {activeView === "chatbot" ? (
          <div className="preview-placeholder full">{renderChatPanel()}</div>
        ) : activeView === "content" ? (
          selectedMedia ? (
            <>
              <div className="video-wrapper">
                <video
                  key={selectedMedia.id}
                  muted
                  autoPlay
                  playsInline
                  controls
                  poster={selectedMedia.thumbnail ?? undefined}
                  onEnded={() => {
                    if (mediaItems.length <= 1) {
                      return;
                    }
                    const nextIndex =
                      currentMediaIndex >= 0
                        ? (currentMediaIndex + 1) % mediaItems.length
                        : 0;
                    setSelectedMedia(mediaItems[nextIndex]);
                  }}
                >
                  <source src={selectedMedia.source} />
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="preview-details">
                <div className="preview-header">
                  <h2>{selectedMedia.title}</h2>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setActiveView("chatbot")}
                  >
                    Head to the AI ChatBot now!
                  </button>
                </div>
                <p>{selectedMedia.description}</p>
                {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                  <div className="preview-tags">
                    {selectedMedia.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="preview-placeholder">
              Select a video from the Content View to begin playback.
            </div>
          )
        ) : (
          renderHomeSlideshow()
        )}
      </main>
    </div>
  );
}

