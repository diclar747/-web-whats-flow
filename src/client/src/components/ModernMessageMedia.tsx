import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Dialog,
  DialogContent,
  Tooltip,
  Skeleton,
  Avatar
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Download,
  Description,
  PictureAsPdf,
  InsertDriveFile,
  Close,
  ZoomIn,
  Mic,
  Videocam,
  Image as ImageIcon
} from '@mui/icons-material';

interface ModernMessageMediaProps {
  type: string;
  mediaUrl?: string;
  media_url?: string; // Fallback snake_case
  mediaMimeType?: string;
  media_mime_type?: string; // Fallback snake_case
  message?: string;
  isFromMe: boolean;
  isDarkMode: boolean;
  fileName?: string;
  senderAvatar?: string; // Nuevo: Avatar del remitente para audios
}

const ModernMessageMedia: React.FC<ModernMessageMediaProps> = ({
  type,
  mediaUrl: propMediaUrl,
  media_url,
  mediaMimeType: propMediaMimeType,
  media_mime_type,
  message,
  isFromMe,
  isDarkMode,
  fileName,
  senderAvatar
}) => {
  const mediaUrl = propMediaUrl || media_url;
  const mediaMimeType = propMediaMimeType || media_mime_type;

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // 🐛 DEBUG: Log props recibidos
  console.log('[ModernMessageMedia] 🔍 Props recibidos:', {
    type,
    mediaUrl,
    mediaMimeType,
    hasMessage: !!message,
    isFromMe,
    fileName
  });

  if (!mediaUrl) {
    console.warn('[ModernMessageMedia] ⚠️ mediaUrl está vacío para tipo:', type);
    return null;
  }

  const getMediaUrl = (url: string) => {
    if (!url) {
      console.warn('[ModernMessageMedia] ⚠️ URL vacía en getMediaUrl');
      return '';
    }

    // 🛡️ SECURITY: Usar proxy para URLs de WhatsApp CDN para evitar 403 y CORS
    if (url.startsWith('http') && (url.includes('whatsapp.net') || url.includes('pps.whatsapp.net') || url.includes('mmg.whatsapp.net'))) {
      console.log('[ModernMessageMedia] 🛡️ Proxying WhatsApp CDN URL:', url.substring(0, 50) + '...');
      return `/api/proxy/avatar?url=${encodeURIComponent(url)}`;
    }

    // Si ya es una URL completa (y no es de WhatsApp), retornarla tal cual
    if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) {
      console.log('[ModernMessageMedia] ✅ URL completa detectada:', url.substring(0, 50) + '...');
      return url;
    }

    // Construir URL completa para rutas relativas
    const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
    const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
    console.log('[ModernMessageMedia] 🔗 URL procesada:', {
      original: url,
      base: API_BASE,
      final: fullUrl
    });
    return fullUrl;
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error descargando archivo:', error);
    }
  };

  const getFileIcon = (extension: string) => {
    const ext = extension.toLowerCase();
    if (ext === 'pdf') return <PictureAsPdf sx={{ fontSize: 40, color: '#f44336' }} />;
    if (['doc', 'docx'].includes(ext)) return <Description sx={{ fontSize: 40, color: '#2196f3' }} />;
    if (['xls', 'xlsx'].includes(ext)) return <Description sx={{ fontSize: 40, color: '#4caf50' }} />;
    return <InsertDriveFile sx={{ fontSize: 40, color: '#9e9e9e' }} />;
  };

  // 🖼️ IMAGEN - Optimizada con lazy loading
  if (type === 'image' || type === 'imageMessage') {
    return (
      <>
        <Box
          sx={{
            position: 'relative',
            maxWidth: '300px',
            borderRadius: '8px',
            overflow: 'hidden',
            cursor: 'pointer',
            '&:hover .image-overlay': {
              opacity: 1
            }
          }}
          onClick={() => setShowImagePreview(true)}
        >
          {isLoading && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height={200}
              sx={{ borderRadius: '8px' }}
            />
          )}
          <img
            src={getMediaUrl(mediaUrl)}
            alt="Imagen"
            loading="lazy" // ⚡ Optimización: Lazy loading
            style={{
              display: isLoading ? 'none' : 'block',
              width: '100%',
              maxHeight: '300px',
              objectFit: 'cover',
              borderRadius: '8px',
              marginBottom: message ? '8px' : '0',
              transition: 'opacity 0.3s ease-in-out',
              opacity: imageLoaded ? 1 : 0
            }}
            onLoad={() => {
              setIsLoading(false);
              setImageLoaded(true);
            }}
            onError={(e) => {
              console.error('[ModernMessageMedia] ❌ Error cargando imagen:', {
                originalUrl: mediaUrl,
                processedUrl: getMediaUrl(mediaUrl),
                type: type,
                error: e
              });
              setIsLoading(false);
              setHasError(true);
            }}
          />

          {!isLoading && !hasError && (
            <Box
              className="image-overlay"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: message ? '30px' : 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                borderRadius: '8px'
              }}
            >
              <ZoomIn sx={{ color: 'white', fontSize: 40 }} />
            </Box>
          )}

          {hasError && (
            <Box
              sx={{
                width: '100%',
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                borderRadius: '8px'
              }}
            >
              <ImageIcon sx={{ fontSize: 50, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
              <Typography variant="caption" color="textSecondary">
                No se pudo cargar la imagen
              </Typography>
            </Box>
          )}

          {message && (
            <Typography variant="body2" sx={{ mt: 1, px: 1 }}>
              {message}
            </Typography>
          )}
        </Box>

        {/* Modal de preview de imagen */}
        <Dialog
          open={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          maxWidth="lg"
          PaperProps={{
            sx: {
              bgcolor: 'transparent',
              boxShadow: 'none',
              maxWidth: '90vw',
              maxHeight: '90vh'
            }
          }}
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={() => setShowImagePreview(false)}
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
              }}
            >
              <Close />
            </IconButton>
            <img
              src={getMediaUrl(mediaUrl)}
              alt="Preview"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '90vh',
                objectFit: 'contain'
              }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // 🎥 VIDEO
  if (type === 'video' || type === 'videoMessage') {
    return (
      <Box sx={{ maxWidth: '350px', borderRadius: '12px', overflow: 'hidden', bgcolor: '#000' }}>
        {isLoading && (
          <Skeleton variant="rectangular" width="100%" height={250} />
        )}
        <video
          controls
          controlsList="nodownload"
          style={{
            display: isLoading ? 'none' : 'block',
            width: '100%',
            maxHeight: '350px',
            borderRadius: '12px'
          }}
          onLoadedMetadata={() => setIsLoading(false)}
          onError={(e) => {
            console.error('[ModernMessageMedia] ❌ Error cargando video:', {
              originalUrl: mediaUrl,
              processedUrl: getMediaUrl(mediaUrl),
              mimeType: mediaMimeType,
              error: e
            });
            setIsLoading(false);
            setHasError(true);
          }}
        >
          <source src={getMediaUrl(mediaUrl)} type={mediaMimeType || 'video/mp4'} />
          Tu navegador no soporta videos
        </video>
        {hasError && (
          <Box
            sx={{
              width: '100%',
              height: '250px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#000'
            }}
          >
            <Videocam sx={{ fontSize: 50, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              No se pudo cargar el video
            </Typography>
          </Box>
        )}
        {message && (
          <Typography variant="body2" sx={{ p: 1.5, bgcolor: isFromMe ? '#005c4b' : '#2a3942', color: 'white' }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  // 🎵 AUDIO - Diseño SOFISTICADO (WhatsApp Style Premium)
  if (type === 'audio' || type === 'audioMessage' || type === 'ptt') {
    const formatTime = (seconds: number) => {
      if (isNaN(seconds)) return "0:00";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return (h > 0 ? `${h}:` : "") + `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setAudioDuration(audioRef.current.duration);
        setIsLoading(false);
      }
    };

    return (
      <Box
        sx={{
          minWidth: '280px',
          maxWidth: '350px',
          p: '10px 14px',
          bgcolor: isFromMe
            ? (isDarkMode ? 'rgba(0, 168, 132, 0.15)' : '#d9fdd3') // Color mensaje WhatsApp Me
            : (isDarkMode ? '#202c33' : '#ffffff'), // Color mensaje WhatsApp Other
          borderRadius: '12px',
          boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Avatar sobre el audio */}
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={senderAvatar}
            sx={{
              width: 48,
              height: 48,
              border: isDarkMode ? '1.5px solid #2a3942' : '1.5px solid #f0f2f5',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          />
          <Box sx={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            bgcolor: '#00a884',
            borderRadius: '50%',
            p: 0.3,
            display: 'flex',
            border: `2px solid ${isFromMe ? (isDarkMode ? '#1e293b' : '#d9fdd3') : (isDarkMode ? '#202c33' : '#ffffff')}`
          }}>
            <Mic sx={{ color: 'white', fontSize: 12 }} />
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={togglePlay}
              sx={{
                padding: 0,
                color: isDarkMode ? '#8696a0' : '#54656f',
                '&:hover': { color: '#00a884' }
              }}
            >
              {isPlaying ? <Pause sx={{ fontSize: 32 }} /> : <PlayArrow sx={{ fontSize: 32 }} />}
            </IconButton>

            {/* Waveform Visualization (Simulada para estética Premium) */}
            <Box sx={{
              flex: 1,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer',
              position: 'relative'
            }}>
              {[...Array(24)].map((_, i) => {
                const isActive = (i / 24) * 100 < audioProgress;
                return (
                  <Box
                    key={i}
                    sx={{
                      width: 2.5,
                      height: `${(Math.sin(i * 0.5) * 10 + 15)}%`,
                      bgcolor: isActive ? '#00a884' : (isDarkMode ? '#54656f' : '#b6bec3'),
                      borderRadius: '4px',
                      transition: 'height 0.2s ease, background-color 0.1s'
                    }}
                  />
                );
              })}

              {/* Overlay invisible para slider real o interactividad */}
              <Box
                sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = x / rect.width;
                  if (audioRef.current) {
                    audioRef.current.currentTime = audioRef.current.duration * pct;
                  }
                }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: isDarkMode ? '#8696a0' : '#667781', fontSize: '0.7rem' }}>
              {isPlaying ? formatTime(currentTime) : (audioDuration ? formatTime(audioDuration) : "0:00")}
            </Typography>
            {isFromMe && (
              <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                {/* Aquí podrías poner el check de visto pero viene de fuera */}
              </Box>
            )}
          </Box>
        </Box>

        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => setHasError(true)}
          style={{ display: 'none' }}
        >
          <source src={getMediaUrl(mediaUrl)} type={mediaMimeType || 'audio/mpeg'} />
          {mediaMimeType?.includes('ogg') && (
            <source src={getMediaUrl(mediaUrl)} type="audio/ogg; codecs=opus" />
          )}
        </audio>

        {hasError && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="error" sx={{ bgcolor: 'white', px: 1, borderRadius: 1 }}>
              Error cargando audio
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // 📄 DOCUMENTO
  if (type === 'document' || type === 'documentMessage') {
    const name = fileName || message || mediaUrl.split('/').pop() || 'archivo';
    const extension = name.split('.').pop()?.toLowerCase() || 'file';
    const isImageDoc = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);

    return (
      <Box
        sx={{
          minWidth: '250px',
          maxWidth: '350px',
          p: 2,
          bgcolor: isFromMe
            ? (isDarkMode ? 'rgba(0, 168, 132, 0.15)' : 'rgba(0, 168, 132, 0.1)')
            : (isDarkMode ? 'rgba(42, 57, 66, 0.8)' : 'rgba(0, 0, 0, 0.05)'),
          borderRadius: '12px',
          border: `1px solid ${isFromMe ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
        }}
      >
        {isImageDoc && (
          <Box sx={{ mb: 1.5, borderRadius: '8px', overflow: 'hidden' }}>
            <img
              src={getMediaUrl(mediaUrl)}
              alt="Documento"
              style={{
                width: '100%',
                maxHeight: '200px',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              onError={() => setHasError(true)}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {!isImageDoc && getFileIcon(extension)}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: isDarkMode ? '#e9edef' : '#111b21',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {name}
            </Typography>
            <Typography variant="caption" sx={{ color: isDarkMode ? '#8696a0' : '#667781', textTransform: 'uppercase' }}>
              {extension} • Documento
            </Typography>
          </Box>

          <Tooltip title="Descargar">
            <IconButton
              size="small"
              onClick={() => handleDownload(getMediaUrl(mediaUrl), name)}
              sx={{
                bgcolor: isFromMe ? 'rgba(0, 168, 132, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  bgcolor: isFromMe ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              <Download sx={{ fontSize: 20, color: '#00a884' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  // 🎭 STICKER
  if (type === 'sticker' || type === 'stickerMessage') {
    return (
      <Box
        sx={{
          maxWidth: '200px',
          p: 0,
          bgcolor: 'transparent'
        }}
      >
        <img
          src={getMediaUrl(mediaUrl)}
          alt="Sticker"
          style={{
            width: '100%',
            maxWidth: '200px',
            height: 'auto',
            backgroundColor: 'transparent'
          }}
          onError={() => setHasError(true)}
        />
        {hasError && (
          <Typography variant="caption" color="error">
            Error al cargar sticker
          </Typography>
        )}
      </Box>
    );
  }

  // Default: Mostrar texto si no hay tipo específico
  return message ? (
    <Typography variant="body2">{message}</Typography>
  ) : null;
};

export default ModernMessageMedia;
