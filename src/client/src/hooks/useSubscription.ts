import { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';

export interface SubscriptionInfo {
  id: number;
  name: string;
  email: string;
  phone: string;
  subscription_plan: string;
  subscription_status: 'active' | 'expired' | 'cancelled' | 'none';
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_days: number;
  is_admin: number;
  days_remaining: number;
  plan_details: {
    id: number;
    plan_name: string;
    plan_display_name: string;
    duration_days: number;
    price: number;
    max_users: number;
    max_messages_per_month: number;
    max_campaigns: number;
    max_contacts: number;
  } | null;
}

export interface UseSubscriptionResult {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  hasActiveSubscription: boolean;
  isAdmin: boolean;
  canAccessFeature: (feature: 'campaigns' | 'bots' | 'chat' | 'calendar' | 'contacts') => boolean;
  refresh: () => Promise<void>;
}

export const useSubscription = (phone?: string): UseSubscriptionResult => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const userType = sessionStorage.getItem('whatsflow_user_type');
      const storedAdminPhone = sessionStorage.getItem('adminPhone') || localStorage.getItem('adminPhone');
      const sessionPhone = sessionStorage.getItem('whatsflow_session');
      let userPhone = phone || sessionPhone || localStorage.getItem('userPhone') || storedAdminPhone || '';

      console.log('[useSubscription] 🔍 Buscando phone en:', {
        prop_phone: phone,
        sessionStorage_whatsflow_session: sessionPhone,
        localStorage_userPhone: localStorage.getItem('userPhone'),
        storedAdminPhone: storedAdminPhone,
        userType: userType,
        final_userPhone: userPhone
      });

      if (!userPhone) {
        console.warn('[useSubscription] ❌ No se encontró el teléfono del usuario');
        setError('No se encontró el teléfono del usuario');
        setLoading(false);
        return;
      }

      // 🧹 Sanitizar teléfono (eliminar :1, :82, etc)
      if (userPhone && userPhone.includes(':')) {
        console.warn(`[useSubscription] ⚠️ Phone tiene sufijo, limpiando: ${userPhone}`);
        userPhone = userPhone.split(':')[0];
      }

      console.log('[useSubscription] ✅ Verificando suscripción para:', userPhone);
      const endpoint = `${getAPIBaseURL()}/api/subscriptions/my-subscription?phone=${userPhone}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      console.log('[useSubscription] Respuesta:', data);

      if (data.success) {
        setSubscription(data.subscription);
        console.log('[useSubscription] Suscripción cargada:', {
          status: data.subscription.subscription_status,
          is_admin: data.subscription.is_admin,
          plan: data.subscription.subscription_plan
        });
      } else {
        console.error('[useSubscription] Primera verificación fallida:', data.error);
        if (data.error?.includes('Usuario no encontrado') && storedAdminPhone && storedAdminPhone !== userPhone) {
          console.log('[useSubscription] Reintentando con storedAdminPhone:', storedAdminPhone);
          const retryResp = await fetch(`${getAPIBaseURL()}/api/subscriptions/my-subscription?phone=${storedAdminPhone}`);
          const retryData = await retryResp.json();
          if (retryData.success) {
            setSubscription(retryData.subscription);
            console.log('[useSubscription] Suscripción encontrada en segundo intento (admin)');
          } else {
            if (userType === 'admin') {
              console.warn('[useSubscription] Falla suscripción, userType=admin: creando suscripción virtual');
              setSubscription({
                id: -1,
                name: 'Administrador',
                email: '',
                phone: storedAdminPhone || userPhone,
                subscription_plan: 'admin',
                subscription_status: 'active',
                subscription_start_date: null,
                subscription_end_date: null,
                subscription_days: 0,
                is_admin: 1,
                days_remaining: 0,
                plan_details: null
              } as SubscriptionInfo);
            } else {
              setError(retryData.error || data.error || 'Error al obtener suscripción');
            }
          }
        } else if (userType === 'admin') {
          console.warn('[useSubscription] Falla suscripción pero userType=admin, creando suscripción virtual');
          setSubscription({
            id: -1,
            name: 'Administrador',
            email: '',
            phone: userPhone,
            subscription_plan: 'admin',
            subscription_status: 'active',
            subscription_start_date: null,
            subscription_end_date: null,
            subscription_days: 0,
            is_admin: 1,
            days_remaining: 0,
            plan_details: null
          } as SubscriptionInfo);
        } else {
          setError(data.error || 'Error al obtener suscripción');
        }
      }
    } catch (err) {
      console.error('[useSubscription] Error fetching subscription:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();

    // Re-fetch si sessionStorage cambia (ej. después de login)
    const intervalId = setInterval(() => {
      const currentSession = sessionStorage.getItem('whatsflow_session');
      if (currentSession && !subscription) {
        console.log('[useSubscription] 🔄 Session detectada, re-fetching...');
        fetchSubscription();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [phone]);

  const userType = sessionStorage.getItem('whatsflow_user_type');
  const isAdmin = subscription?.is_admin === 1 || userType === 'admin';
  const hasActiveSubscription = isAdmin || subscription?.subscription_status === 'active';

  // Solo loguear cuando subscription cambia, no en cada render
  useEffect(() => {
    if (subscription || error) {
      console.log('[useSubscription] 📊 Estado final:', {
        isAdmin,
        hasActiveSubscription,
        subscription_status: subscription?.subscription_status,
        subscription_is_admin: subscription?.is_admin,
        userType,
        error
      });
    }
  }, [subscription, error]);

  const canAccessFeature = (feature: 'campaigns' | 'bots' | 'chat' | 'calendar' | 'contacts'): boolean => {
    const hasAccess = isAdmin || hasActiveSubscription;
    console.log(`[useSubscription] canAccessFeature(${feature}):`, hasAccess);
    return hasAccess;
  };

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription,
    isAdmin,
    canAccessFeature,
    refresh: fetchSubscription
  };
};
