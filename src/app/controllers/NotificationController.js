import Notification from '../schemas/Notification';
import User from '../models/User';

class NotificationController {
  async index(req, res) {
    const isProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isProvider) {
      return res.status(400).json({ error: 'User is not a provider.' });
    }

    const notifications = await Notification.find({
      user: req.userId,
    })
      .sort({ createAt: 'desc' })
      .limit(20);

    return res.status(200).json(notifications);
  }

  async update(req, res) {
    const notifications = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    return res.status(200).json(notifications);
  }
}

export default new NotificationController();
