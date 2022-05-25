import { OnInit, ViewChild } from '@angular/core';
import { Component } from '@angular/core';
import { MapInfoWindow, MapMarker, GoogleMap } from '@angular/google-maps';
import { DataService } from './services/data.service';
import { EntityStateCodes } from './properties/states';
import * as XLSX from 'xlsx';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  @ViewChild(GoogleMap, { static: false }) map: GoogleMap;
  @ViewChild(MapInfoWindow, { static: false }) info: MapInfoWindow;

  // Initializing global variables
  title = 'Power Plants Distribution';
  stateValue: string = 'All';
  plantsFilterValue: string = '0';
  topPlantsFilter = [5, 10, 20, 40, 75, 100, 1000];
  states = EntityStateCodes.stateCodes;
  zoom = 5;
  center: google.maps.LatLngLiteral;
  options: google.maps.MapOptions = {
    zoomControl: false,
    scrollwheel: true,
    disableDoubleClickZoom: true,
    mapTypeId: 'roadmap',
  };
  markers: any = [];
  infoContent = '';
  dataArray: any = [];
  mapIsLoading: boolean = true;

  constructor(private dataService: DataService, private titleService: Title) {}

  ngOnInit() {
    this.setTitle(this.title); 
    // reset map to default values
    this.resetMap();

    // wait for 1 second to let map load before reading data from file
    setTimeout(() => {
      this.readData();
    }, 1000);
  }

  setTitle(title: string) {
    this.titleService.setTitle(title);
  }

  // Method to zoom in
  zoomIn() {
    return this.zoom++;
  }

  // Method to zoom out
  zoomOut() {
    return this.zoom--;
  }

  // Method to reset map to default values
  resetMap() {
    this.zoom = 5;
    this.center = {
      lat: 39.723574386033725,
      lng: -96.332138875,
    };
    this.markers = [];

    // Using setTimeout here to let this.map initilizes on the first run before accessing it
    setTimeout(() => {
      this.map.panTo(this.center);
      this.stateValue = 'All';
      this.plantsFilterValue = '0';
    });
  }

  //Method to add markers on the map
  addMarker(data: any) {
    const late: number = data['LAT'];
    const long: number = data['LON'];

    this.markers.push({
      position: {
        lat: late,
        lng: long,
      },
      title: data.PNAME,
      info: data,
    });
  }

  // Method to read data from API service
  readData() {
    return this.dataService.sendGetRequest().subscribe((data: any) => {
      // Reading excel file and converting it to JSON for consumption
      const reader: FileReader = new FileReader();
      reader.readAsBinaryString(data);
      reader.onload = (file: any) => {
        const binarystr: string = file.target.result;
        const wb: XLSX.WorkBook = XLSX.read(binarystr, { type: 'binary' });

        // selecting the correct sheet
        const workSheetName: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[workSheetName];

        // saving the data into an array
        this.dataArray = XLSX.utils.sheet_to_json(ws);

        //sorting the array based on plant total annual net generation
        this.dataArray.sort(function (a: any, b: any) {
          return b.PLNGENAN - a.PLNGENAN;
        });

        this.mapIsLoading = false;
      };
    });
  }

  // Method to open marker info on the map to view information about a plant
  openInfo(marker: MapMarker, plantInfo: any) {
    // Filtering to get all plants per state
    const plantsPerState: any[] = this.dataArray.filter(
      (plant: any) => plant.PSTATABB === plantInfo.PSTATABB
    );

    // calculating total state net generation
    let totalStateNetGen = 0;
    plantsPerState.forEach((plant) => {
      totalStateNetGen += plant.PLNGENAN;
    });

    // Calculating the percentage of the plant total net generation within the state
    const plantPercentage = this.percentage(
      plantInfo.PLNGENAN,
      totalStateNetGen
    );

    // HTML context to be displayed in the info message
    this.infoContent =
      '<div>' +
      '<h1>' +
      plantInfo.PNAME +
      '</h1>' +
      '<div>' +
      '<p><h3>Plant annual net generation (MWh)</h3> <a>' +
      Math.abs(plantInfo.PLNGENAN) +
      '</a></p>' +
      '<p><h3>Percentage of plant annual net generation across state</h3> <a>' +
      plantPercentage +
      '%</a></p>' +
      '</div>' +
      '</div>';
    this.info.open(marker);
  }

  // Method to calculate percentage
  percentage(plantNetGen: number, totalStateNetGen: number) {
    return ((100 * plantNetGen) / totalStateNetGen).toFixed(2);
  }

  // Method to filter map view and focus to a specific state
  filterByState(event: any) {
    // loading the page and clearing up markers array
    this.mapIsLoading = true;
    this.markers = [];

    // If state selection is to view all states, modify map view to reflect that. Also, calling filterTopPlants method to make sure we show selected top plants
    if (this.stateValue === 'All') {
      this.zoom = 5;
      this.map.panTo(this.center);
      this.filterTopPlants();
      this.mapIsLoading = false;
      return;
    }

    // Getting all the plants per state in this filtering
    const plantsPerState: any[] = this.dataArray.filter(
      (plant: any) => plant.PSTATABB === this.stateValue
    );

    // SetTimeout is not needed here, but this is just for graphical purposes.
    setTimeout(() => {
      // Grabbing static info of the desired state for ease of navigation
      const state = EntityStateCodes.stateCodes.find((result) => {
        if (result.abbreviation === this.stateValue) {
          return true;
        }
      });

      this.zoom = state.zoom;
      this.map.panTo({ lat: state.latitude, lng: state.longitude });

      // Checking if plants filtering list is zero, return no markers if true.
      if (!parseInt(this.plantsFilterValue)) {
        this.mapIsLoading = false;
        return;
      }

      // Getting Top N plants selected by the user from the Select Top Plants list on the UI
      plantsPerState.some((plant: any, index: number) => {
        this.addMarker(plant);
        return index === parseInt(this.plantsFilterValue) - 1;
      });
      this.mapIsLoading = false;
    }, 2000);
  }

  // Method to filter top N plants
  filterTopPlants() {
    // clearing markers array and return empty map view if no selection on the Top plants filter
    this.markers = [];
    if (!parseInt(this.plantsFilterValue)) return;

    // if all states selected, View the top N plants in all of the U.S.
    if (this.stateValue === 'All') {
      console.log('I am here');
      this.dataArray.some((plant: any, index: number) => {
        this.addMarker(plant);
        console.log(index);
        return index === parseInt(this.plantsFilterValue) - 1;
      });
    }
    // if only one state selected, View top N plants of that state.
    else {
      // Filtering per state
      const plantsPerState: any[] = this.dataArray.filter(
        (plant: any) => plant.PSTATABB === this.stateValue
      );

      // Set the Top Plants filtering based on how mant plants in that state, If a state has less plants than the selected number of filtering, then view all plants on that state.
      let limit =
        plantsPerState.length < parseInt(this.plantsFilterValue)
          ? plantsPerState.length
          : parseInt(this.plantsFilterValue);

      // Loop to add markers for top N plants
      for (let i = 0; i < limit; i++) {
        this.addMarker(plantsPerState[i]);
      }
    }
  }

}
