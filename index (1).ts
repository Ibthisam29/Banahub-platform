import { Router } from 'express';
import { authenticate, requireRole } from '../utils/auth.middleware';
import {
  getMembers, getMember, updateMemberStatus, getStats
} from '../controllers/member.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin'), getMembers);
router.get('/stats', requireRole('admin'), getStats);
router.get('/:id', requireRole('admin'), getMember);
router.patch('/:id/status', requireRole('admin'), updateMemberStatus);

export default router;
