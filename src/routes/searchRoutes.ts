import express from 'express';
import { globalSearch } from '../controllers/searchController';

const router = express.Router();

router.get('/', globalSearch);

export default router;
