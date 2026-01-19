import { getFeedbackMetadata } from '../_storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const metadata = await getFeedbackMetadata(id);

    if (!metadata) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ exists: true, createdAt: metadata.createdAt });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
}
