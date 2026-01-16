import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Dialog,
  DialogContent,
  Tooltip,
  Skeleton
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
  mediaMimeType?: string;
  message?: string;
  isFromMe: boolean;
  isDarkMode: boolean;
  fileName?: string;
}

const ModernMessageMedia: React.FC<ModernMessageMediaProps> = ({
  type,
  mediaUrl,
  mediaMimeType,
  message,
  isFromMe,
  isDarkMode,
  fileName
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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
      return url;
    }

    // Construir URL completa para rutas relativas
    const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
    const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
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

  // 🎵 AUDIO
  if (type === 'audio' || type === 'audioMessage' || type === 'ptt') {
    const isPTT = type === 'ptt';
    return (
      <Box
        sx={{
          minWidth: '250px',
          maxWidth: '350px',
          p: 1.5,
          bgcolor: isFromMe
            ? (isDarkMode ? 'rgba(0, 168, 132, 0.15)' : 'rgba(0, 168, 132, 0.1)')
            : (isDarkMode ? 'rgba(42, 57, 66, 0.8)' : 'rgba(0, 0, 0, 0.05)'),
          borderRadius: '12px',
          border: `1px solid ${isFromMe ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Mic sx={{ color: '#00a884', fontSize: 24 }} />
        <Box sx={{ flex: 1 }}>
          <audio
            controls
            controlsList="nodownload"
            style={{
              width: '100%',
              height: '32px',
              outline: 'none'
            }}
            onError={(e) => {
              console.error('[ModernMessageMedia] ❌ Error cargando audio:', {
                originalUrl: mediaUrl,
                processedUrl: getMediaUrl(mediaUrl),
                mimeType: mediaMimeType,
                error: e
              });
              setHasError(true);
            }}
          >
            <source src={getMediaUrl(mediaUrl)} type={mediaMimeType || 'audio/mpeg'} />
            Tu navegador no soporta audio
          </audio>
        </Box>
        {hasError && (
          <Typography variant="caption" color="error">
            Error al cargar audio
          </Typography>
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
