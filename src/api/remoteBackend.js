import { base44 } from './base44Client';
import { ApiError } from './backend';

export const remoteBackend = {
  async call(action, args) {
    try {
      const res = await base44.functions.invoke('app', { action, args });
      return res.data;
    } catch (err) {
      const status = err?.response?.status ?? 0;
      const body = err?.response?.data || {};
      throw new ApiError(body.error || (status ? 'server_error' : 'network_error'), status, body);
    }
  },
};
