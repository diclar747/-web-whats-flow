import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    Tooltip,
    Dialog,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useSocket } from '../context/SocketContext';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface ContactStatus {
    jid: string;
    name: string;
    phone: string;
    avatar?: string | null;
    statuses: {
        id: string;
        type: 'image' | 'video' | 'text';
        url?: string;
        caption?: string;
        timestamp: number;
    }[];
    unreadCount: number;
}

interface HorizontalStatusListProps {
    sessionId: string;
    colors: any;
}

const HorizontalStatusList: React.FC<HorizontalStatusListProps> = ({ sessionId, colors }) => {
    const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [contactViewer, setContactViewer] = useState<{ contact: ContactStatus; statusIndex: number } | null>(null);
    const [showArrows, setShowArrows] = useState(false);
    const { on, off } = useSocket();
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const resolveMediaUrl = (url?: string | null) => {
        if (!url) return null;
        return url.startsWith('http') ? url : `${getAPIBaseURL()}${url}`;
    };

    const loadContactStatuses = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const res = await fetch(`${getAPIBaseURL()}/api/whatsapp/statuses/${sessionId}`);
            const data = await res.json();

            if (data.success && data.statuses) {
                // Sort by most recent status
                const sorted = data.statuses.sort((a: any, b: any) =>
                    (b.statuses[0]?.timestamp || 0) - (a.statuses[0]?.timestamp || 0)
                );
                setContactStatuses(sorted);
            }
        } catch (error) {
            console.error('[HORIZONTAL-STATUS-LIST] Error cargando estados:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContactStatuses();
    }, [sessionId]);

    useEffect(() => {
        const handler = (data: any) => {
            const jid = String(data.jid || '');
            const name = String(data.name || jid.split('@')[0]);
            const url = data.mediaUrl ? (String(data.mediaUrl).startsWith('http') ? String(data.mediaUrl) : `${getAPIBaseURL()}${String(data.mediaUrl)}`) : undefined;
            const type = (data.type === 'image' || data.type === 'video') ? data.type : 'text';
            const caption = data.content || undefined;
            const timestamp = Number(data.timestamp || Date.now());

            setContactStatuses(prev => {
                const existing = prev.find(c => c.jid === jid);
                if (!existing) {
                    const newStatus: ContactStatus = {
                        jid,
                        name,
                        phone: jid.split('@')[0],
                        avatar: null,
                        statuses: [{ id: `${jid}-${timestamp}`, type, url, caption, timestamp }],
                        unreadCount: 1
                    };
                    return [newStatus, ...prev];
                }

                const updated = prev.map(c => {
                    if (c.jid !== jid) return c;
                    const nextStatuses = [
                        { id: `${jid}-${timestamp}`, type, url, caption, timestamp },
                        ...c.statuses
                    ].slice(0, 30);
                    return {
                        ...c,
                        statuses: nextStatuses,
                        unreadCount: nextStatuses.length
                    };
                });
                return updated.sort((a, b) => (b.statuses[0]?.timestamp || 0) - (a.statuses[0]?.timestamp || 0));
            });
        };

        on('new-status', handler);
        return () => off('new-status');
    }, [on, off]);

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return '1d';
    };

    if (!sessionId) return null;

    return (
        <Box
            onMouseEnter={() => setShowArrows(true)}
            onMouseLeave={() => setShowArrows(false)}
            sx={{
                p: '14px 16px',
                bgcolor: colors.sidebar,
                borderBottom: `1px solid ${colors.divider}`,
                overflow: 'hidden',
                position: 'relative',
                '&:hover .carousel-arrow': {
                    opacity: 1,
                    visibility: 'visible'
                }
            }}
        >
            {/* Carousel Arrows */}
            <IconButton
                className="carousel-arrow"
                onClick={() => scroll('left')}
                sx={{
                    position: 'absolute',
                    left: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    bgcolor: 'rgba(0,0,0,0.4)',
                    color: 'white',
                    opacity: 0,
                    visibility: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'translateY(-50%) scale(1.1)' },
                    display: { xs: 'none', sm: 'flex' }
                }}
            >
                <ChevronLeftIcon />
            </IconButton>

            <IconButton
                className="carousel-arrow"
                onClick={() => scroll('right')}
                sx={{
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    bgcolor: 'rgba(0,0,0,0.4)',
                    color: 'white',
                    opacity: 0,
                    visibility: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'translateY(-50%) scale(1.1)' },
                    display: { xs: 'none', sm: 'flex' }
                }}
            >
                <ChevronRightIcon />
            </IconButton>

            <Box
                ref={scrollRef}
                sx={{
                    display: 'flex',
                    gap: '20px',
                    overflowX: 'auto',
                    pb: '4px',
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                    scrollBehavior: 'smooth',
                    alignItems: 'flex-start',
                    maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 10px, black calc(100% - 10px), transparent)'
                }}
            >
                {loading && contactStatuses.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1 }}>
                        <CircularProgress size={16} sx={{ color: colors.primary }} />
                        <Typography variant="caption" sx={{ color: colors.textSecondary }}>Buscando estados...</Typography>
                    </Box>
                ) : contactStatuses.length === 0 ? (
                    <Box sx={{ py: 1, px: 1 }}>
                        <Typography variant="caption" sx={{ color: colors.textTertiary, fontStyle: 'italic' }}>
                            Sin estados compartidos
                        </Typography>
                    </Box>
                ) : (
                    contactStatuses.map((contact) => (
                        <Tooltip key={contact.jid} title={`${contact.name || contact.phone}`} arrow>
                            <Box
                                onClick={() => setContactViewer({ contact, statusIndex: 0 })}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    minWidth: 70,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        transform: 'translateY(-2px) scale(1.02)',
                                        '& .status-avatar-container': {
                                            boxShadow: `0 0 12px ${contact.unreadCount > 0 ? colors.primary : 'transparent'}`
                                        }
                                    }
                                }}
                            >
                                <Box
                                    className="status-avatar-container"
                                    sx={{
                                        position: 'relative',
                                        padding: '3px',
                                        borderRadius: '50%',
                                        background: contact.unreadCount > 0
                                            ? `linear-gradient(45deg, ${colors.primary}, ${colors.primaryLight || '#818cf8'})`
                                            : 'transparent',
                                        boxShadow: contact.unreadCount > 0 ? `0 0 8px ${colors.primary}40` : 'none',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: contact.unreadCount === 0 ? `1px solid ${colors.divider}` : 'none'
                                    }}
                                >
                                    <Box sx={{
                                        bgcolor: colors.sidebar,
                                        borderRadius: '50%',
                                        padding: '2px',
                                        display: 'flex'
                                    }}>
                                        <Avatar
                                            src={`${getAPIBaseURL()}/api/avatar/${sessionId}/${contact.jid}`}
                                            sx={{
                                                width: 54,
                                                height: 54,
                                                bgcolor: colors.header,
                                                border: `1px solid ${colors.divider}`,
                                                fontSize: '1.2rem',
                                                fontWeight: 600,
                                                color: colors.textSecondary
                                            }}
                                        >
                                            {(contact.name || contact.phone).charAt(0).toUpperCase()}
                                        </Avatar>
                                    </Box>

                                    {contact.unreadCount > 0 && (
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 2,
                                            right: 2,
                                            width: 14,
                                            height: 14,
                                            bgcolor: colors.primary,
                                            borderRadius: '50%',
                                            border: `2px solid ${colors.sidebar}`,
                                            zIndex: 2
                                        }} />
                                    )}
                                </Box>

                                <Box sx={{ textAlign: 'center', width: '100%' }}>
                                    <Typography
                                        variant="caption"
                                        noWrap
                                        sx={{
                                            display: 'block',
                                            color: contact.unreadCount > 0 ? colors.text : colors.textSecondary,
                                            fontWeight: contact.unreadCount > 0 ? 700 : 500,
                                            fontSize: '0.72rem',
                                            lineHeight: 1.2,
                                            maxWidth: 68
                                        }}
                                    >
                                        {contact.name || contact.phone.split('@')[0]}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: '0.62rem',
                                            color: colors.textTertiary,
                                            fontWeight: 400
                                        }}
                                    >
                                        {formatTime(contact.statuses[0]?.timestamp || Date.now())}
                                    </Typography>
                                </Box>
                            </Box>
                        </Tooltip>
                    ))
                )}
            </Box>

            {/* Internal Status Viewer for the Horizontal List */}
            <Dialog
                open={!!contactViewer}
                onClose={() => setContactViewer(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: '#000', m: 0, borderRadius: 0 } }}
                sx={{
                    '& .MuiDialog-paper': {
                        maxHeight: '100vh',
                        height: '100vh'
                    }
                }}
            >
                {contactViewer && (
                    <Box sx={{ position: 'relative', height: '100%', bgcolor: '#000' }}>
                        {/* Header */}
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, p: 2,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                            display: 'flex', alignItems: 'center', gap: 2
                        }}>
                            <IconButton onClick={() => setContactViewer(null)} sx={{ color: 'white' }}>
                                <CloseIcon />
                            </IconButton>
                            <Avatar
                                src={`${getAPIBaseURL()}/api/avatar/${sessionId}/${contactViewer.contact.jid}`}
                                sx={{ width: 40, height: 40 }}
                            />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                                    {contactViewer.contact.name || contactViewer.contact.phone}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {new Date(contactViewer.contact.statuses[contactViewer.statusIndex]?.timestamp).toLocaleTimeString()}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Progress Indicators */}
                        <Box sx={{ position: 'absolute', top: 60, left: 8, right: 8, zIndex: 10, display: 'flex', gap: 0.5 }}>
                            {contactViewer.contact.statuses.map((_, idx) => (
                                <Box key={idx} sx={{
                                    flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden'
                                }}>
                                    {idx <= contactViewer.statusIndex && (
                                        <Box sx={{ width: '100%', height: '100%', bgcolor: 'white' }} />
                                    )}
                                </Box>
                            ))}
                        </Box>

                        {/* Content Display */}
                        <Box
                            sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isRight = (e.clientX - rect.left) > rect.width / 2;
                                if (isRight) {
                                    if (contactViewer.statusIndex < contactViewer.contact.statuses.length - 1) {
                                        setContactViewer({ ...contactViewer, statusIndex: contactViewer.statusIndex + 1 });
                                    } else {
                                        setContactViewer(null);
                                    }
                                } else {
                                    if (contactViewer.statusIndex > 0) {
                                        setContactViewer({ ...contactViewer, statusIndex: contactViewer.statusIndex - 1 });
                                    }
                                }
                            }}
                        >
                            {(() => {
                                const status = contactViewer.contact.statuses[contactViewer.statusIndex];
                                if (status.type === 'image' || status.type === 'video') {
                                    return (
                                        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                                            {status.type === 'image' ? (
                                                <img src={resolveMediaUrl(status.url) || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                                            ) : (
                                                <video src={resolveMediaUrl(status.url) || ''} autoPlay controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            )}
                                            {status.caption && (
                                                <Box sx={{
                                                    position: 'absolute', bottom: 0, left: 0, right: 0, p: 4,
                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                                    textAlign: 'center'
                                                }}>
                                                    <Typography sx={{ color: 'white', fontSize: '1.1rem' }}>{status.caption}</Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                }
                                return (
                                    <Box sx={{ p: 4 }}>
                                        <Typography variant="h5" sx={{ color: 'white', textAlign: 'center' }}>
                                            {status.caption || 'Estado de texto'}
                                        </Typography>
                                    </Box>
                                );
                            })()}
                        </Box>
                    </Box>
                )}
            </Dialog>
        </Box>
    );
};

export default HorizontalStatusList;
