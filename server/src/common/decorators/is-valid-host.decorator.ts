import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { validateHost } from '../utils/ssrf-validator.util';

@ValidatorConstraint({ name: 'isValidHost', async: true })
export class IsValidHostConstraint implements ValidatorConstraintInterface {
  async validate(host: string, args: ValidationArguments) {
    if (!host) return true;
    return await validateHost(host).catch(() => false);
  }

  defaultMessage(args: ValidationArguments) {
    return `Host address ($value) is not allowed for security reasons (SSRF).`;
  }
}

export function IsValidHost(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidHostConstraint,
    });
  };
}
