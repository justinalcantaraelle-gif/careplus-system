import React, { useEffect, useRef } from 'react';

const TurnstileWidget = ({ action = 'login', onVerify, onError, onExpire }) => {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const callbacksRef = useRef({ onVerify, onError, onExpire });

    // Keep callbacks up-to-date in ref without causing the widget to re-render/re-mount
    useEffect(() => {
        callbacksRef.current = { onVerify, onError, onExpire };
    });

    const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local')
    );
    const siteKey = isLocal 
        ? '1x00000000000000000000AA' 
        : (process.env.REACT_APP_TURNSTILE_SITE_KEY || '0x4AAAAAAEGRwIc5u1PwgA-F');

    useEffect(() => {
        if (!siteKey || !containerRef.current) return;

        let isCancelled = false;

        const renderWidget = () => {
            if (isCancelled || !containerRef.current || widgetIdRef.current !== null) return;
            if (window.turnstile && typeof window.turnstile.render === 'function') {
                try {
                    widgetIdRef.current = window.turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        action: action || 'login',
                        theme: 'light',
                        size: 'normal',
                        callback: (token) => {
                            if (!isCancelled && callbacksRef.current.onVerify) {
                                callbacksRef.current.onVerify(token);
                            }
                        },
                        'error-callback': (err) => {
                            if (!isCancelled && callbacksRef.current.onError) {
                                callbacksRef.current.onError(err);
                            }
                        },
                        'expired-callback': () => {
                            if (!isCancelled && callbacksRef.current.onExpire) {
                                callbacksRef.current.onExpire();
                            }
                        },
                        'timeout-callback': () => {
                            if (!isCancelled && callbacksRef.current.onExpire) {
                                callbacksRef.current.onExpire();
                            }
                        }
                    });
                } catch (e) {
                    console.error('[Turnstile Render Error]:', e);
                }
            }
        };

        if (window.turnstile && typeof window.turnstile.render === 'function') {
            renderWidget();
        } else {
            const existingScript = document.getElementById('cf-turnstile-script');
            if (!existingScript) {
                const script = document.createElement('script');
                script.id = 'cf-turnstile-script';
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.crossOrigin = 'anonymous';
                script.onload = () => {
                    renderWidget();
                };
                script.onerror = (err) => {
                    console.error('[Turnstile Script Load Error]: Failed to load Cloudflare Turnstile script.', err);
                    if (!isCancelled && callbacksRef.current.onError) {
                        callbacksRef.current.onError('Turnstile script failed to load.');
                    }
                };
                document.head.appendChild(script);
            } else {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.turnstile && typeof window.turnstile.render === 'function') {
                        clearInterval(checkInterval);
                        renderWidget();
                    } else if (attempts > 100) {
                        clearInterval(checkInterval);
                    }
                }, 50);
            }
        }

        return () => {
            isCancelled = true;
            if (widgetIdRef.current !== null && window.turnstile && typeof window.turnstile.remove === 'function') {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    // Ignore cleanup errors
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, action]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
            <div ref={containerRef} />
        </div>
    );
};

export default TurnstileWidget;
