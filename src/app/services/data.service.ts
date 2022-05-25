import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  //private REST_API_SERVER = "https://www.epa.gov/system/files/documents/2022-01/egrid2020_data.xlsx";

  private REST_API_SERVER2 = "assets/egrid2020_data.xlsx";

  constructor(private httpClient: HttpClient) { }

  public sendGetRequest(){
     let headers = new HttpHeaders();
     headers = headers.set("Content-Type","application/vnd.ms-excel");
    // headers = headers.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');


    return this.httpClient.get(this.REST_API_SERVER2, {headers: headers, responseType: 'blob'});
  }
}
