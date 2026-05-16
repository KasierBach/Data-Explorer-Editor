import { Injectable } from '@nestjs/common';

export interface PiiColumn {
  name: string;
  table: string;
  schema: string;
  type:
    | 'email'
    | 'phone'
    | 'credit_card'
    | 'ssn'
    | 'password'
    | 'name'
    | 'address'
    | 'ip'
    | 'unknown';
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class PiiDetectionService {
  private readonly patterns: Array<{
    type: PiiColumn['type'];
    confidence: PiiColumn['confidence'];
    regex: RegExp;
  }> = [
    {
      type: 'password',
      confidence: 'high',
      regex: /pass(word|wd)?|pwd|secret|token|api[_\s]?key/i,
    },
    { type: 'email', confidence: 'high', regex: /e[-_]?mail|email[_\s]?addr/i },
    { type: 'phone', confidence: 'high', regex: /phone|mobile|tel|fax/i },
    {
      type: 'credit_card',
      confidence: 'high',
      regex: /card|cc[_\s]?num|credit|cvv|ccv/i,
    },
    {
      type: 'ssn',
      confidence: 'high',
      regex: /ssn|social[_\s]?sec|national[_\s]?id|tax[_\s]?id/i,
    },
    {
      type: 'name',
      confidence: 'medium',
      regex:
        /first[_\s]?name|last[_\s]?name|full[_\s]?name|given[_\s]?name|family[_\s]?name/i,
    },
    {
      type: 'address',
      confidence: 'medium',
      regex: /address|street|city|zip|postal/i,
    },
    {
      type: 'ip',
      confidence: 'medium',
      regex: /ip[_\s]?addr|ip[_\s]?address|remote[_\s]?ip/i,
    },
  ];

  detect(
    columns: { name: string; type?: string }[],
    schema: string,
    table: string,
  ): PiiColumn[] {
    const results: PiiColumn[] = [];

    for (const col of columns) {
      const match = this.findMatch(col.name);
      if (match) {
        results.push({
          name: col.name,
          table,
          schema,
          type: match.type,
          confidence: match.confidence,
        });
      }
    }

    return results;
  }

  maskValue(value: unknown, piiType: PiiColumn['type']): string {
    const str =
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '';
    if (str.length === 0) return str;

    switch (piiType) {
      case 'password':
        return '********';
      case 'email':
        return this.maskEmail(str);
      case 'phone':
        return this.maskPhone(str);
      case 'credit_card':
        return this.maskCreditCard(str);
      case 'ssn':
        return this.maskSsn(str);
      case 'name':
        return this.maskName(str);
      case 'ip':
        return this.maskIp(str);
      default:
        return str.substring(0, Math.min(3, str.length)) + '***';
    }
  }

  private findMatch(columnName: string) {
    return this.patterns.find((p) => p.regex.test(columnName)) || null;
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const local = parts[0];
    const domain = parts[1];
    const maskedLocal =
      local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
    return `${maskedLocal}@${domain}`;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return digits.slice(0, 2) + '****' + digits.slice(-2);
  }

  private maskCreditCard(cc: string): string {
    const digits = cc.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return '****-****-****-' + digits.slice(-4);
  }

  private maskSsn(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length < 4) return '***-**-****';
    return '***-**-' + digits.slice(-4);
  }

  private maskName(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.map((p) => (p.length > 1 ? p[0] + '***' : '***')).join(' ');
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length !== 4) return '***.***.***.***';
    return `${parts[0]}.***.***.${parts[3]}`;
  }
}
