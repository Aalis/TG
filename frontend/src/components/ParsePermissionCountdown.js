import React, { useState, useEffect } from 'react';
import { Chip, Tooltip } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import BlockIcon from '@mui/icons-material/Block';
import { format, formatDistanceToNow, isPast } from 'date-fns';

export default function ParsePermissionCountdown({ expiresAt, canParse }) {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt) return;

        const updateCountdown = () => {
            const expiry = new Date(expiresAt);
            if (isPast(expiry)) {
                setIsExpired(true);
                setTimeLeft('Expired');
                return;
            }

            setIsExpired(false);
            setTimeLeft(formatDistanceToNow(expiry));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [expiresAt]);

    if (!canParse) {
        return (
            <Tooltip title="Parse permission is disabled">
                <Chip
                    icon={<BlockIcon />}
                    label="Parse Disabled"
                    color="default"
                    size="small"
                    sx={{ ml: 2 }}
                />
            </Tooltip>
        );
    }

    if (!expiresAt) {
        return (
            <Tooltip title="Parse permission is enabled (no expiration)">
                <Chip
                    icon={<TimerIcon />}
                    label="Parse Enabled"
                    color="success"
                    size="small"
                    sx={{ ml: 2 }}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip title={`Parse permission ${isExpired ? 'expired' : 'expires'} on ${format(new Date(expiresAt), 'dd.MM.yyyy HH:mm')}`}>
            <Chip
                icon={<TimerIcon />}
                label={isExpired ? 'Expired' : `${timeLeft} left`}
                color={isExpired ? 'error' : 'success'}
                size="small"
                sx={{ ml: 2 }}
            />
        </Tooltip>
    );
} 