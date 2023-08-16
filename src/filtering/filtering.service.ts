import { Injectable } from '@nestjs/common';
import {
  Insurance,
  Company,
  Gender,
  RegistrationType,
  PriceRangeType,
  ValueType,
  PriceMinMaxType,
  InsuranaceType,
} from '../insurance-suggesters/interfaces/question-tagged.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FilteringService {
  constructor(private readonly prismaService: PrismaService) {}
  private mapCompanyName(name: string) {
    const enumKey = Object.keys(Company).find(
      (key) => Company[key as keyof typeof Company] === name,
    );
    return enumKey ? (enumKey as keyof typeof Company) : undefined;
  }

  private mapPriceRange(range: any[]): [PriceRangeType?, ValueType?] {
    const rangeType = Object.values(PriceRangeType).find(
      (val) => val === range[0],
    );
    const valueType = Object.values(ValueType).find((val) => val === range[1]);
    return [rangeType, valueType];
  }

  async mapResponseToInsuranceType(data: Insurance): Promise<Insurance> {
    const matchedGenderKey = Object.keys(Gender).find(
      (key) => Gender[key as keyof typeof Gender] === data['Gender'],
    );

    const matchedRegistrationTypeKey = Object.keys(RegistrationType).find(
      (key) =>
        RegistrationType[key as keyof typeof RegistrationType] ===
        data['Registration Type'],
    );

    const tags = {
      companyName: data['Company Name']
        ? data['Company Name'].map(this.mapCompanyName)
        : undefined,
      gender: matchedGenderKey
        ? Gender[matchedGenderKey as keyof typeof Gender]
        : undefined,
      registrationType: matchedRegistrationTypeKey
        ? RegistrationType[
            matchedRegistrationTypeKey as keyof typeof RegistrationType
          ]
        : undefined,
      insurancePriceRangeIndex: data['Insurance Price Range Index']
        ? data['Insurance Price Range Index'].map(this.mapPriceRange)
        : undefined,
      insuranceType: data['Insurance Type']
        ? InsuranaceType[data['Insurance Type'] as keyof typeof InsuranaceType]
        : undefined,
      age: data['Age'] ? data['Age'] : undefined,
      priceIndex: data['Price Index']
        ? parseFloat(data['Price Index'])
        : undefined,
      price: data['Insurance Price']
        ? parseFloat(data['Insurance Price'])
        : undefined,
    };
    return tags;
  }

  async filtering(data: Insurance) {
    const {
      companyName,
      gender,
      registrationType,
      insurancePriceRangeIndex,
      insurancePriceMinMaxIndex,
      price,
      priceIndex,
      age,
    } = data;
    let where = {};
    // 1. 보험 이름 조회

    if (companyName) {
      where = {
        ...where,
        OR: companyName.map((name) => ({ companyName: name })),
      };
    }

    // 3. 가입 방법 필터링

    if (registrationType) {
      where = {
        ...where,
        registrationType: registrationType,
      };
    }
    // 4. 이상 이하 범위 지정
    if (insurancePriceRangeIndex) {
      const rangeConditions = [];
      for (const range of insurancePriceRangeIndex) {
        if (!range[1]) continue;

        switch (range[1]) {
          case 'price':
            const priceField =
              gender === 'man' ? 'premiumMale' : 'premiumFemale';

            if (range[0] === 'over') {
              rangeConditions.push({ [priceField]: { gte: price } });
            } else if (range[0] === 'less') {
              rangeConditions.push({ [priceField]: { lte: price } });
            } else if (range[0] === 'around') {
              rangeConditions.push({
                [priceField]: { gte: price - 5000, lte: price + 5000 },
              });
            }
            break;

          case 'age':
            if (range[0] === 'over') {
              rangeConditions.push({ insuranceAgeGroup: { gte: age } });
            } else if (range[0] === 'less') {
              rangeConditions.push({ insuranceAgeGroup: { lte: age } });
            } else if (range[0] === 'around') {
              rangeConditions.push({
                insuranceAgeGroup: { gte: age - 5, lte: price + 5 },
              });
            }
            break;

          case 'priceIndex':
            if (range[0] === 'over') {
              rangeConditions.push({ priceIndex: { gte: priceIndex } });
            } else if (range[0] === 'less') {
              rangeConditions.push({ priceIndex: { lte: priceIndex } });
            } else if (range[0] === 'around') {
              rangeConditions.push({
                priceIndex: { gte: priceIndex - 5, lte: priceIndex + 5 },
              });
            }
            break;
        }
      }

      if (rangeConditions.length) {
        where = {
          ...where,
          OR: rangeConditions,
        };
      }
    }

    // 5. 최대 최소 범위 지정
    if (insurancePriceMinMaxIndex) {
      const minMaxConditions = [];

      for (const range of insurancePriceMinMaxIndex) {
        if (!range[1]) continue;

        switch (range[1]) {
          case 'price':
            const priceField =
              gender === 'man' ? 'premiumMale' : 'premiumFemale';

            if (range[0] === 'max') {
              minMaxConditions.push({ [priceField]: { lte: price } });
            } else if (range[0] === 'min') {
              minMaxConditions.push({ [priceField]: { gte: price } });
            } else if (range[0] === 'mid') {
              minMaxConditions.push({
                [priceField]: {
                  gte: price - price * 0.1,
                  lte: price + price * 0.1,
                },
              });
            }
            break;

          case 'age':
            if (range[0] === 'max') {
              minMaxConditions.push({ insuranceAgeGroupEnd: { lte: age } });
            } else if (range[0] === 'min') {
              minMaxConditions.push({ insuranceAgeGroupStart: { gte: age } });
            } else if (range[0] === 'mid') {
              minMaxConditions.push({
                insuranceAgeGroupStart: { gte: age - 1 },
                insuranceAgeGroupEnd: { lte: age + 1 },
              });
            }
            break;

          case 'priceIndex':
            if (range[0] === 'max') {
              minMaxConditions.push({ priceIndex: { lte: priceIndex } });
            } else if (range[0] === 'min') {
              minMaxConditions.push({ priceIndex: { gte: priceIndex } });
            } else if (range[0] === 'mid') {
              minMaxConditions.push({
                priceIndex: { gte: priceIndex - 5, lte: priceIndex + 5 },
              });
            }
            break;
        }
      }

      if (minMaxConditions.length) {
        where = {
          ...where,
          OR: minMaxConditions,
        };
      }
    }

    // 만약 insurancePriceMinMaxIndex, insurancePriceRangeIndex를 거치지 않은 age, price, priceIndex가 있다면
    // 그 주변 범위의 값을 필터링

    const insuranceInfos = await this.prismaService.insuranceInfo.findMany({
      where: where,
      include: {
        insuranceLogo: true,
      },
    });
    return insuranceInfos;
  }
}