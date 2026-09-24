import React, { useState } from 'react';
import { Alert } from 'react-native';
import { appActions, selectAccount, selectAccounts, useAppStore } from '../../state/appStore';
import { CloudSync, useCloudStatus, type CloudStatusState } from '../../core/services/cloud/cloudSync';
import { disconnectCloud } from '../../core/services/cloud/supabaseClient';
import { formatRelativeDate } from '../../core/utils/workout';
import { FeedbackService } from '../../core/services/feedback';
import { Card, ListRow } from '../../components/ui';
import { signInWithGoogleAndCloud } from '../auth/googleCloud';

function lastCopy(at?: number) {
  if (!at) return 'Aún sin copia';
  const time = new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Última copia: ${formatRelativeDate(at).toLowerCase()}, ${time}`;
}

function describe({ status, lastSyncedAt }: CloudStatusState) {
  switch (status) {
    case 'syncing':
      return { icon: 'sync-outline' as const, subtitle: 'Sincronizando…' };
    case 'offline':
      return { icon: 'cloud-offline-outline' as const, subtitle: 'Sin conexión. Se sincroniza al volver' };
    case 'needs_auth':
      return { icon: 'alert-circle-outline' as const, subtitle: 'Toca para reconectar con Google' };
    default:
      return { icon: 'cloud-done-outline' as const, subtitle: lastCopy(lastSyncedAt) };
  }
}

/** Turns the Supabase backup on/off and shows its state. Only rendered when the cloud is configured. */
export function CloudBackupSection() {
  const account = useAppStore(selectAccount);
  const accounts = useAppStore(selectAccounts);
  const cloud = useCloudStatus();
  const [busy, setBusy] = useState(false);

  if (!account) return null;

  const connectGoogle = async () => {
    setBusy(true);
    const result = await signInWithGoogleAndCloud();
    setBusy(false);
    if (result.status === 'error') Alert.alert('Google', result.message);
    if (result.status !== 'success') return null;
    if (!result.cloudUserId) {
      Alert.alert('Respaldo', result.cloudError ?? 'No pudimos conectar con el respaldo.');
      return null;
    }
    return { identity: result.identity, cloudUserId: result.cloudUserId };
  };

  const enable = async () => {
    const connected = await connectGoogle();
    if (!connected) return;
    const { identity, cloudUserId } = connected;
    const taken = accounts.some((item) => item.id !== account.id && item.email === identity.email);
    if (taken) {
      await disconnectCloud();
      Alert.alert('Cuenta en uso', `${identity.email} ya tiene otro perfil en este teléfono. Entra con él desde el inicio.`);
      return;
    }
    FeedbackService.success();
    await appActions.enableCloudBackup(identity, cloudUserId);
  };

  const reconnect = async () => {
    const connected = await connectGoogle();
    if (!connected) return;
    const ok = await appActions.reconnectCloud(connected.cloudUserId);
    if (ok) FeedbackService.success();
    else Alert.alert('Otra cuenta', `Este perfil se respalda con ${account.email}. Elige esa cuenta de Google.`);
  };

  const disable = () => {
    Alert.alert('Desactivar respaldo', 'Tus datos siguen en este teléfono y en la copia que ya existe, pero los cambios nuevos no se respaldarán.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: () => appActions.disableCloudBackup() },
    ]);
  };

  if (!account.cloudUserId) {
    return (
      <Card padding={0}>
        <ListRow
          icon="cloud-upload-outline"
          title={busy ? 'Conectando…' : 'Respaldar mis datos'}
          subtitle="Vincula Google y recupera todo si cambias de teléfono"
          onPress={busy ? undefined : enable}
        />
      </Card>
    );
  }

  const { icon, subtitle } = describe(cloud);
  return (
    <Card padding={0}>
      <ListRow
        icon={icon}
        title={busy ? 'Conectando…' : 'Respaldo activo'}
        subtitle={`${account.email ?? 'Google'} · ${subtitle}`}
        onPress={busy || cloud.status === 'syncing' ? undefined : cloud.status === 'needs_auth' ? reconnect : () => CloudSync.syncNow()}
      />
      <ListRow icon="cloud-outline" title="Desactivar respaldo" subtitle="Tus datos quedan en este teléfono" onPress={disable} />
    </Card>
  );
}
