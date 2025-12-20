import { FastifyInstance } from 'fastify';
import { LeaseManager, Lease } from '@cueplay/lease-core';

// In-memory store
const leases = new Map<string, Lease>();

export async function leaseRoutes(fastify: FastifyInstance) {
    fastify.post('/leases', async (req, reply) => {
        const body = req.body as { deviceId: string, roomId?: string };
        if (!body.deviceId) {
            return reply.code(400).send({ error: 'deviceId is required' });
        }

        const lease = LeaseManager.generateLease(body.deviceId, body.roomId);
        leases.set(lease.id, lease);
        fastify.log.info({ msg: 'Lease granted', id: lease.id, deviceId: lease.deviceId });
        return { lease };
    });

    fastify.post('/leases/:id/renew', async (req, reply) => {
        const { id } = req.params as { id: string };
        const lease = leases.get(id);

        if (!lease) {
            return reply.code(404).send({ error: 'Lease not found' });
        }

        try {
            LeaseManager.renewLease(lease);
            fastify.log.info({ msg: 'Lease renewed', id: lease.id });
            return { lease };
        } catch (e: any) {
            return reply.code(400).send({ error: e.message });
        }
    });

    fastify.delete('/leases/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const lease = leases.get(id);

        if (!lease) {
            return reply.code(404).send({ error: 'Lease not found' });
        }

        LeaseManager.revokeLease(lease);
        fastify.log.info({ msg: 'Lease revoked', id: lease.id });
        return { lease };
    });
}
