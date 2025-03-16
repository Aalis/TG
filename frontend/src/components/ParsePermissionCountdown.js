import React, { useState, useEffect } from 'react';
import { Chip, Tooltip } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import BlockIcon from '@mui/icons-material/Block';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { ru, enUS } from 'date-fns/locale';

export default function ParsePermissionCountdown({ expiresAt, canParse }) {
    const { t, i18n } = useTranslation();
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt) return;

        const updateCountdown = () => {
            const expiry = new Date(expiresAt);
            if (isPast(expiry)) {
                setIsExpired(true);
                setTimeLeft(t('common.expired', 'Expired'));
                return;
            }

            setIsExpired(false);
            // Use the appropriate locale based on the current language
            const locale = i18n.language === 'ru' ? ru : enUS;
            setTimeLeft(formatDistanceToNow(expiry, { locale }));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [expiresAt, t, i18n.language]);

    if (!canParse) {
        return (
            <Tooltip title={t('telegram.parsePermissionDisabled', 'Parse permission is disabled')}>
                <Chip
                    icon={<BlockIcon />}
                    label={t('telegram.parseDisabled', 'Parse Disabled')}
                    color="default"
                    size="small"
                    sx={{ ml: 2 }}
                />
            </Tooltip>
        );
    }

    if (!expiresAt) {
        return (
            <Tooltip title={t('telegram.parsePermissionEnabled', 'Parse permission is enabled (no expiration)')}>
                <Chip
                    icon={<TimerIcon />}
                    label={t('telegram.parseEnabled', 'Parse Enabled')}
                    color="success"
                    size="small"
                    sx={{ ml: 2 }}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip title={t(
            isExpired ? 'telegram.parsePermissionExpired' : 'telegram.parsePermissionExpires', 
            {
                date: format(new Date(expiresAt), 'dd.MM.yyyy HH:mm')
            },
            `Parse permission ${isExpired ? 'expired' : 'expires'} on ${format(new Date(expiresAt), 'dd.MM.yyyy HH:mm')}`
        )}>
            <Chip
                icon={<TimerIcon />}
                label={isExpired ? t('common.expired', 'Expired') : `${t('common.left', 'left')} ${timeLeft}`}
                color={isExpired ? 'error' : 'success'}
                size="small"
                sx={{ ml: 2 }}
            />
        </Tooltip>
    );
} 