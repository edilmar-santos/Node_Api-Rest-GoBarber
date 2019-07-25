import * as Yup from 'yup';
import { startOfHour, isBefore, parse, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';
import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: {
        model: User,
        as: 'provider',
        attributes: ['id', 'name'],
        include: {
          model: File,
          as: 'avatar',
          attributes: ['id', 'path', 'url'],
        },
      },
    });

    return res.status(200).json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails.' });
    }

    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only make an appointment with providers.' });
    }

    const startHour = startOfHour(parse(date));

    if (isBefore(startHour, new Date())) {
      return res.status(400).json({ error: 'Past dates are not allowed. ' });
    }

    const isHourNotAvailable = await Appointment.findOne({
      where: { provider_id, date: startHour, canceled_at: null },
    });

    if (isHourNotAvailable) {
      return res
        .status(400)
        .json({ error: 'Appointment date is not available.' });
    }
    /**
     * Notify appointment provider
     */
    const user = await User.findByPk(req.userId);
    const formatedDate = format(
      startHour,
      '[dia] DD [de] MMMM[, às] HH:mm[h]',
      {
        locale: pt,
      }
    );

    await Notification.create({
      content: `New appointment of ${user.name} to ${formatedDate}`,
      user: provider_id,
    });

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date,
    });

    return res.status(201).json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: 'You do not have permission to cancel this appointment.',
      });
    }

    const dateLimitToCancel = subHours(appointment.date, 2);

    if (isBefore(dateLimitToCancel, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel an appointment 2 hours in advance.',
      });
    }

    appointment.canceled_at = new Date();
    await appointment.save();

    await Queue.add(CancellationMail.key, { appointment });

    return res.status(200).json(appointment);
  }
}

export default new AppointmentController();
