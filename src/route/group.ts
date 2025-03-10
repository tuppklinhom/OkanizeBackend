import { Router } from 'express';
import KeyPair from '../module/KeyPair';

const router = Router();

router.post('/create', KeyPair.requireAuth(), (req, res) => {
    
})

router.post('/invite', (req, res) => {

})

router.post('/accept', (req, res) => {

})

router.post('/query', (req, res) => {

})

router.post('/transaction/create', (req, res) => {

})

router.post('/transaction/query', (req, res) => {

})

router.post('/transaction/split', (req, res) => {

})

router.post('/transaction/confirm', (req, res) => {

})
export default router;