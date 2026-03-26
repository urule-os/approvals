export interface Config {
  port: number;
  host: string;
  natsUrl: string;
  registryUrl: string;
  temporalAddress: string;
  temporalNamespace: string;
  serviceName: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    natsUrl: process.env['NATS_URL'] ?? 'nats://localhost:4222',
    registryUrl: process.env['REGISTRY_URL'] ?? 'http://localhost:3500',
    temporalAddress: process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
    temporalNamespace: process.env['TEMPORAL_NAMESPACE'] ?? 'urule',
    serviceName: 'urule-approvals',
  };
}
