import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { validateHost } from '../utils/ssrf-validator.util';

@ValidatorConstraint({ name: 'isValidHost', async: true })
export class IsValidHostConstraint implements ValidatorConstraintInterface {
  async validate(host: string, args: ValidationArguments) {
    if (!host) return true;
    return await validateHost(host).catch(() => false);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Địa chỉ host ($value) không được phép truy cập vì lý do bảo mật (SSRF).';
  }
}

export function IsValidHost(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidHostConstraint,
    });
  };
}
