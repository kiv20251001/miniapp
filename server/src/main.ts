import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './common/api-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, forbidUnknownValues: false }))
  app.useGlobalFilters(new ApiExceptionFilter())
  const port = Number(process.env.PORT || 3000)
  await app.listen(port)
  console.log(`MyHome API http://127.0.0.1:${port}/api`)
}

bootstrap()
