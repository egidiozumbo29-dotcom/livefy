import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { CreatorsController } from "./creators.controller";
import { CreatorsService } from "./creators.service";

@Module({
  imports: [AuthModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, OptionalJwtAuthGuard],
  exports: [CreatorsService],
})
export class CreatorsModule {}
