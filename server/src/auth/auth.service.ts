import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { createId } from '../domain/constants'
import { BusinessError } from '../common/business-error'
import { PrismaService } from '../prisma.service'
import { createEmptyFamilySnapshot } from '../workspace/empty-snapshot'
import { LoginDto, RegisterDto } from './auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const username = dto.username.trim()
    const existing = await this.prisma.account.findUnique({ where: { username } })
    if (existing) {
      throw new BusinessError('USERNAME_TAKEN', '这个账号已被注册', 409)
    }

    const accountId = createId('acct')
    const familyId = createId('fam')
    const memberId = createId('member')
    const preferenceId = createId('pref')
    const snapshot = createEmptyFamilySnapshot()
    const passwordHash = await bcrypt.hash(dto.password, 10)
    const name = (dto.name || username).trim()

    await this.prisma.$transaction([
      this.prisma.account.create({
        data: { id: accountId, username, passwordHash, name },
      }),
      this.prisma.family.create({
        data: {
          id: familyId,
          createdByAccountId: accountId,
          timezone: 'Asia/Shanghai',
          snapshotJson: JSON.stringify(snapshot),
        },
      }),
      this.prisma.familyMember.create({
        data: { id: memberId, accountId, familyId, role: 'parent' },
      }),
      this.prisma.accountPreference.create({
        data: {
          id: preferenceId,
          accountId,
          familyId,
          defaultChildId: snapshot.session.childId,
        },
      }),
    ])

    return this.issueSession(accountId, familyId, 'parent', username, name)
  }

  async login(dto: LoginDto) {
    const account = await this.prisma.account.findUnique({
      where: { username: dto.username.trim() },
      include: { memberships: true },
    })
    if (!account) {
      throw new BusinessError('INVALID_CREDENTIALS', '账号或密码不正确', 401)
    }
    const matched = await bcrypt.compare(dto.password, account.passwordHash)
    if (!matched) {
      throw new BusinessError('INVALID_CREDENTIALS', '账号或密码不正确', 401)
    }
    const membership = account.memberships[0]
    if (!membership) {
      throw new BusinessError('FAMILY_MISSING', '账号尚未加入家庭', 403)
    }
    return this.issueSession(
      account.id,
      membership.familyId,
      membership.role as 'parent' | 'child',
      account.username,
      account.name,
    )
  }

  private issueSession(
    accountId: string,
    familyId: string,
    role: 'parent' | 'child',
    username: string,
    name: string,
  ) {
    const accessToken = this.jwt.sign({
      sub: accountId,
      familyId,
      role,
      username,
    })
    return {
      accessToken,
      account: { id: accountId, username, name },
      family: { id: familyId, role },
    }
  }
}
