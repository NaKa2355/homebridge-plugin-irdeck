import { ListRemotesRequest, PushButtonRequest } from 'pirem-proto/gen/js/api/v1/pirem_service_pb'
import { Remote } from 'pirem-proto/gen/js/api/v1/remote_pb';
import { PiRemServiceClient } from 'pirem-proto/gen/js/api/v1/pirem_service_grpc_web_pb'


export class IrdeckApi {
  private readonly piremClient:PiRemServiceClient;

  constructor(piremUrl: string) {
    this.piremClient = new PiRemServiceClient(piremUrl);
  }

  public getRemotes = () => {
    const promise = new Promise<Remote[]>((resolve, reject) => {
      this.piremClient.listRemotes(new ListRemotesRequest(), {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(res.getRemotesList());
        return;
      });
    });
    return promise;
  };

  public pushButton = (buttonId: string) => {
    const promise = new Promise((resolve, reject) => {
      const req = new PushButtonRequest()
      req.setButtonId(buttonId)
      this.piremClient.pushButton(req, {}, (err) => {
        if (err) {
          reject(err);
          return
        }
      })
    })
    return promise
  }
}