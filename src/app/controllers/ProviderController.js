import User from '../models/User';
import File from '../models/File';

class ProviderController {
  async index(req, res) {
    const providers = await User.findAll({
      where: { provider: true },
      attributes: ['id', 'name', 'email'],
      include: {
        model: File,
        attributes: ['name', 'path', 'url'],
        as: 'avatar',
      },
    });

    return res.status(200).json(providers);
  }
}

export default new ProviderController();
