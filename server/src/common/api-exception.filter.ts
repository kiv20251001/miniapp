import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Response } from 'express'
import { BusinessError } from './business-error'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof BusinessError) {
      response.status(exception.status).json({
        code: exception.code,
        message: exception.message,
      })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const body = typeof payload === 'string' ? { message: payload } : (payload as Record<string, unknown>)
      const message = Array.isArray(body.message) ? body.message[0] : body.message
      response.status(status).json({
        code: body.code ?? (status === 401 ? 'UNAUTHENTICATED' : 'HTTP_ERROR'),
        message: String(message || exception.message),
      })
      return
    }

    console.error(exception)
    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务暂时不可用',
    })
  }
}
