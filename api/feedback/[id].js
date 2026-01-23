import { getFeedbackMetadata } from '../_storage.js';
import { logError } from '../_logger.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  console.log('═══ GET METADATA ═══');
  console.log('Feedback ID:', id);

  try {
    const metadata = await getFeedbackMetadata(id);

    if (!metadata) {
      console.log('Result: NOT FOUND');
      console.log('════════════════════');
      return res.status(404).json({ error: 'Feedback not found' });
    }

    console.log('Result: SUCCESS');
    console.log('════════════════════');
    res.json({
      exists: true,
      createdAt: metadata.createdAt,
      senderName: metadata.senderName,
      recipientName: metadata.recipientName,
      relationship: metadata.relationship
    });
  } catch (error) {
    logError('/api/feedback/[id] (GET)', error, {
      'Feedback ID': id || '(not provided)'
    });
    res.status(500).json({ error: 'Failed to get feedback' });
  }
}
