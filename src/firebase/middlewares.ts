import { getAuth } from 'firebase-admin/auth';
import { DoesNotExist } from '@alexi/db/models';

import { User } from './models/model.ts';

export const authentication = async (req, res, next) => {
  req.user = null;

  try {
    const auth = getAuth();
    const idToken = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    try {
      req.user = await User.objects.get({ id: decodedToken.uid });
    } catch (error) {
      if (error instanceof DoesNotExist) {
        req.user = await User.objects.create({
          id: decodedToken.uid,
          name: decodedToken.name,
          email: decodedToken.email,
          phone: decodedToken.phone,
          picture: decodedToken.picture,
        });
      } else {
        throw error;
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying ID token:', error);
    res.status(403).send('Unauthorized');
  }
};
